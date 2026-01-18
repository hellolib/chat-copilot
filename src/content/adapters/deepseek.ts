/**
 * DeepSeek Adapter
 */

import {BaseAdapter} from './base';

export class DeepSeekAdapter extends BaseAdapter {
  name = 'DeepSeek';
  hostPatterns = ['chat.deepseek.com'];

  getInputElement(): HTMLElement | null {
    return document.querySelector('textarea[placeholder]');
  }

  getSendButton(): HTMLElement | null {
    return document.querySelector('div[style="width: fit-content;"]');
  }

  getInputValue(): string {
    const input = this.getInputElement() as HTMLTextAreaElement | null;
    return input?.value ?? '';
  }

  setInputValue(value: string): void {
    const input = this.getInputElement() as HTMLTextAreaElement | null;
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event('input', {bubbles: true}));
    }
  }

  /**
   * 查找按钮容器 - 使用多种策略
   */
  findButtonContainer(): HTMLElement | null {
    return this.findElementWithStrategies([
      // 策略1: 通过发送按钮的父元素查找
      () => {
        const sendButton = this.getSendButton();
        return sendButton?.parentElement as HTMLElement || null;
      },

      // 策略2: 通过输入框的父容器查找
      () => {
        const input = this.getInputElement();
        if (input) {
          const form = input.closest('form');
          if (form) {
            const buttonContainer = form.querySelector('div.flex, div.button-container, div[class*="toolbar"]');
            return buttonContainer as HTMLElement || null;
          }
        }
        return null;
      },

      // 策略3: 查找包含多个按钮的容器
      () => {
        const buttons = document.querySelectorAll('button[type="submit"], button[type="button"]');
        for (const btn of buttons) {
          const parent = btn.parentElement;
          if (parent && parent.querySelectorAll('button').length > 1) {
            return parent as HTMLElement;
          }
        }
        return null;
      },
    ]);
  }
}
