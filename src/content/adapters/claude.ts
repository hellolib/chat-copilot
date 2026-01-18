/**
 * Claude Adapter
 */

import { BaseAdapter } from './base';

export class ClaudeAdapter extends BaseAdapter {
  name = 'Claude';
  hostPatterns = ['claude.ai'];

  getInputElement(): HTMLElement | null {
    return document.querySelector('div[contenteditable="true"]');
  }

  getSendButton(): HTMLElement | null {
    return document.querySelector('button[aria-label="Send message"]');
  }

  getInputValue(): string {
    const input = this.getInputElement();
    return input?.textContent ?? '';
  }

  setInputValue(value: string): void {
    const input = this.getInputElement();
    if (input) {
      input.textContent = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /**
   * 查找按钮容器 - 使用多种策略
   */
  findButtonContainer(): HTMLElement | null {
    return this.findElementWithStrategies([
      // 策略1: 通过 data-testid 查找
      () => {
        const targetButton = document.querySelector('button[data-testid="model-selector-dropdown"][type="button"]');
        return targetButton?.parentElement as HTMLElement || null;
      },

      // 策略2: 通过模型选择器的 aria-label 查找
      () => {
        const buttons = document.querySelectorAll('button[type="button"]');
        for (const btn of buttons) {
          // 查找包含模型名称的按钮（Claude 3.5 Sonnet, etc）
          if (btn.textContent && (btn.textContent.includes('Claude') || btn.textContent.includes('Haiku') || btn.textContent.includes('Sonnet') || btn.textContent.includes('Opus'))) {
            return btn.parentElement as HTMLElement || null;
          }
        }
        return null;
      },

      // 策略3: 通过输入框附近的工具栏查找
      () => {
        const input = this.getInputElement();
        if (input) {
          // 查找输入区域上方的工具栏
          const form = input.closest('form, div[role="form"]');
          if (form) {
            const toolbar = form.querySelector('div[role="toolbar"], div.flex.items-center');
            return toolbar as HTMLElement || null;
          }
        }
        return null;
      },
    ]);
  }

  /**
   * 插入按钮到容器（覆盖基类）
   */
  protected insertButton(button: HTMLElement, container: HTMLElement): void {
    // Claude 特定：插入到父容器的模型选择器前面
    if (container.parentElement) {
      container.parentElement.insertBefore(button, container);
    } else {
      super.insertButton(button, container);
    }
  }
}
