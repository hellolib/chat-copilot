/**
 * Base Platform Adapter
 * 提供统一的按钮注入策略和样式
 */

import { PlatformAdapter } from '@shared/types';
import { createLogoUseSvg } from '../ui/logoSprite';

export abstract class BaseAdapter implements PlatformAdapter {
  abstract name: string;
  abstract hostPatterns: string[];

  abstract getInputElement(): HTMLElement | null;
  abstract getSendButton(): HTMLElement | null;
  abstract getInputValue(): string;
  abstract setInputValue(value: string): void;

  /**
   * 子类需要实现的查找按钮容器的方法
   */
  abstract findButtonContainer(): HTMLElement | null;

  /**
   * 统一的按钮注入方法
   * 支持重试机制和错误处理
   */
  injectButton(button: HTMLElement, maxRetries = 3): void {
    let retryCount = 0;

    const attemptInjection = () => {
      const container = this.findButtonContainer();

      if (!container) {
        retryCount++;
        if (retryCount < maxRetries) {
          // 延迟重试，等待页面加载
          setTimeout(attemptInjection, 500);
          return;
        }
        this.logWarning(`未找到注入位置，已重试 ${maxRetries} 次`);
        return;
      }

      try {
        // 检查按钮是否已经注入
        if (this.isButtonAlreadyInjected(container)) {
          this.logInfo('按钮已存在，跳过注入');
          return;
        }

        this.styleButton(button);
        this.insertButton(button, container);
        this.logInfo('按钮注入成功');
      } catch (error) {
        this.logError('按钮注入失败', error);
      }
    };

    attemptInjection();
  }

  /**
   * 检查按钮是否已经注入
   */
  protected isButtonAlreadyInjected(container: HTMLElement): boolean {
    return container.querySelector('.chat-copilot-btn') !== null;
  }

  /**
   * 设置按钮样式
   */
  protected styleButton(button: HTMLElement): void {
    button.className = 'chat-copilot-btn';
    // 保留必要的布局样式，但让 CSS 控制悬停效果（背景色、透明度、变换等）
    // 这样可以保持悬停效果的一致性（绿色特效）
    button.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      position: relative;
    `;

    if (button.childElementCount === 0) {
      const svg = createLogoUseSvg('chat-copilot-btn-icon', 18);
      svg.style.width = '18px';
      svg.style.height = '18px';
      svg.style.display = 'block';
      svg.style.margin = 'auto';
      svg.style.pointerEvents = 'none';
      button.appendChild(svg);
    }
  }

  /**
   * 插入按钮到容器
   */
  protected insertButton(button: HTMLElement, container: HTMLElement): void {
    // 默认插入到容器的第一个位置
    container.insertBefore(button, container.firstChild);
  }

  /**
   * 检查平台是否就绪
   */
  isReady(): boolean {
    return this.getInputElement() !== null && this.getSendButton() !== null;
  }

  /**
   * 等待平台就绪
   */
  async waitForReady(timeout = 5000): Promise<boolean> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const check = () => {
        if (this.isReady()) {
          resolve(true);
          return;
        }

        if (Date.now() - startTime > timeout) {
          this.logWarning(`平台未在 ${timeout}ms 内就绪`);
          resolve(false);
          return;
        }

        requestAnimationFrame(check);
      };

      check();
    });
  }

  /**
   * 使用多种策略查找元素（提供给子类使用的工具方法）
   */
  protected findElementWithStrategies(strategies: (() => HTMLElement | null)[]): HTMLElement | null {
    for (let i = 0; i < strategies.length; i++) {
      try {
        const element = strategies[i]();
        if (element) {
          this.logInfo(`策略 ${i + 1} 成功找到元素`);
          return element;
        }
      } catch (error) {
        this.logWarning(`策略 ${i + 1} 执行失败`, error);
      }
    }
    return null;
  }

  /**
   * 日志方法 - 信息
   */
  protected logInfo(message: string): void {
    console.log(`[Chat Copilot - ${this.name}] ${message}`);
  }

  /**
   * 日志方法 - 警告
   */
  protected logWarning(message: string, error?: unknown): void {
    console.warn(`[Chat Copilot - ${this.name}] ${message}`, error || '');
  }

  /**
   * 日志方法 - 错误
   */
  protected logError(message: string, error?: unknown): void {
    console.error(`[Chat Copilot - ${this.name}] ${message}`, error || '');
  }
}
