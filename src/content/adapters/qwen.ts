/**
 * Qwen (通义千问 Chat) Adapter
 */

import { BaseAdapter } from './base';

export class QwenAdapter extends BaseAdapter {
  name = '通义千问';
  hostPatterns = ['chat.qwen.ai'];

  private readonly SEND_BUTTON_SELECTORS = [
    '.omni-button-content button',
    '.chat-prompt-send-button .send-button',
    '.chat-prompt-send-button .stop-button',
  ];

  getInputElement(): HTMLElement | null {
    return document.querySelector('textarea#chat-input.chat-input');
  }

  getSendButton(): HTMLElement | null {
    for (const selector of this.SEND_BUTTON_SELECTORS) {
      const element = document.querySelector(selector);
      if (element) {
        return element as HTMLElement;
      }
    }

    return null;
  }

  getInputValue(): string {
    const input = this.getInputElement() as HTMLTextAreaElement | null;
    return input?.value ?? '';
  }

  setInputValue(value: string): void {
    const input = this.getInputElement() as HTMLTextAreaElement | null;
    if (!input) {return;}

    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    input.focus();
    try {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    } catch {
      // ignore
    }
  }

  /**
   * 查找按钮容器 - 使用多种策略
   */
  findButtonContainer(): HTMLElement | null {
    return this.findElementWithStrategies([
      // 策略1: action bar 左侧按钮区域（最稳定）
      () => {
        const sendButton = this.getSendButton();
        return sendButton?.parentElement as HTMLElement || null;
      },

      // 策略2: action bar 左侧容器
      () => document.querySelector('.prompt-input-action-bar .action-bar-left') as HTMLElement,

      // 策略3: 通过输入框向上找 action bar
      () => {
        const input = this.getInputElement();
        return (input?.closest('.prompt-input-container')?.querySelector('.prompt-input-action-bar') as HTMLElement) || null;
      },
    ]);
  }
}
