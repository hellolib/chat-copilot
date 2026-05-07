/**
 * Base Platform Adapter
 * 提供统一的按钮注入策略和样式
 */

import { PlatformAdapter, ConversationMessage } from '@shared/types';
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
   * 获取当前对话标题（默认使用 document.title）
   */
  getChatTitle(): string {
    return document.title || 'chat';
  }

  /**
   * 默认的对话历史提取方法（子类可覆盖以实现更精确的提取）
   *
   * 提取策略（按优先级）:
   * 1. 查找带有 data-role 或 data-message-author-role 属性的元素
   * 2. 按顺序查找对话容器中的消息节点
   * 3. 退回到按 class 名称匹配
   */
  getConversationHistory(): ConversationMessage[] {
    const messages: ConversationMessage[] = [];

    try {
      // 策略1: 通过 data-* 属性精确匹配（多数现代 AI 平台使用）
      const roleElements = document.querySelectorAll<HTMLElement>(
        '[data-role="user"], [data-role="assistant"], ' +
        '[data-message-author-role="user"], [data-message-author-role="assistant"]',
      );
      if (roleElements.length > 0) {
        roleElements.forEach(el => {
          const roleAttr = el.getAttribute('data-role') || el.getAttribute('data-message-author-role');
          if (roleAttr !== 'user' && roleAttr !== 'assistant') { return; }
          const text = this.extractElementText(el);
          if (text) {
            messages.push({ role: roleAttr, content: text });
          }
        });
        // 如果通过 data 属性提取到了消息，按 DOM 顺序排序
        if (messages.length > 1) {
          messages.sort((a, b) => {
            const aIndex = Array.from(roleElements).findIndex(el => el.textContent?.trim() === a.content);
            const bIndex = Array.from(roleElements).findIndex(el => el.textContent?.trim() === b.content);
            return aIndex - bIndex;
          });
        }
        return messages;
      }

      // 策略2: 通过共同的父容器按顺序提取
      const chatContainer = this.findChatContainer();
      if (chatContainer) {
        const messageNodes = chatContainer.querySelectorAll<HTMLElement>(
          '[class*="message"], [class*="chat"], [class*="conversation"], article',
        );
        messageNodes.forEach(node => {
          const text = this.extractElementText(node);
          if (!text) { return; }

          const classAttr = node.className?.toLowerCase() || '';

          if (classAttr.includes('user') || classAttr.includes('human')) {
            messages.push({ role: 'user', content: text });
          } else if (classAttr.includes('assistant') || classAttr.includes('bot') || classAttr.includes('ai')) {
            messages.push({ role: 'assistant', content: text });
          }
        });
      }

      // 如果仍然没有提取到，退回搜索
      if (messages.length === 0) {
        const userElements = document.querySelectorAll<HTMLElement>('[class*="user"], [class*="human"]');
        const assistantElements = document.querySelectorAll<HTMLElement>('[class*="assistant"], [class*="bot"], [class*="ai"]');

        userElements.forEach(el => {
          const text = this.extractElementText(el);
          if (text) { messages.push({ role: 'user', content: text }); }
        });
        assistantElements.forEach(el => {
          const text = this.extractElementText(el);
          if (text) { messages.push({ role: 'assistant', content: text }); }
        });
      }
    } catch (error) {
      console.warn(`[Chat Copilot - ${this.name}] 提取对话历史失败:`, error);
    }

    return messages;
  }

  /**
   * 从元素中提取纯文本内容，排除脚本、样式等干扰
   */
  protected extractElementText(element: HTMLElement): string {
    try {
      // 克隆节点并移除干扰元素
      const clone = element.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('script, style, svg, button, nav, header, footer').forEach(el => el.remove());

      // 收集所有文本行
      const lines: string[] = [];
      const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, null);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const text = node.textContent?.trim();
        if (text && text.length > 1) { // 过滤单个字符的残留
          lines.push(text);
        }
      }

      const result = lines.join('\n').trim();
      return result.length > 5 ? result : ''; // 至少5个字符才有意义
    } catch {
      return element.textContent?.trim() || '';
    }
  }

  /**
   * 尝试查找对话容器
   */
  protected findChatContainer(): HTMLElement | null {
    const selectors = [
      '[class*="chat-container"]',
      '[class*="conversation"]',
      '[class*="message-list"]',
      '[class*="chat-list"]',
      '[class*="thread"]',
      'main',
      '[role="main"]',
      '[role="region"]',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element as HTMLElement;
      }
    }

    return null;
  }

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
