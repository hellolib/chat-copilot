/**
 * Qianwen (通义千问) Adapter
 */

import { BaseAdapter } from './base';

export class QianwenAdapter extends BaseAdapter {
  name = '通义千问';
  hostPatterns = ['www.qianwen.com', 'tongyi.aliyun.com', 'chat.qwen.ai'];

  private isQwenChat(): boolean {
    return window.location.hostname.includes('chat.qwen.ai');
  }

  getInputElement(): HTMLElement | null {
    if (this.isQwenChat()) {
      return document.querySelector('textarea#chat-input.chat-input');
    }

    return document.querySelector('textarea[placeholder]');
  }

  getSendButton(): HTMLElement | null {
    if (this.isQwenChat()) {
      // chat.qwen.ai 的“发送”按钮是动态出现的；这里用一个稳定存在的右侧按钮做就绪检测/定位。
      return document.querySelector('.prompt-input-action-bar .omni-button-content button');
    }

    return document.querySelector('span[data-icon-type="qwpcicon-sendChat"]');
  }

  getInputValue(): string {
    const input = this.getInputElement() as HTMLTextAreaElement | null;
    return input?.value ?? '';
  }

  setInputValue(value: string): void {
    const input = this.getInputElement() as HTMLTextAreaElement | null;
    if (!input) {return;}

    // React/受控组件场景：优先走原生 setter，保证框架能感知到值变化
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // 聚焦并把光标移到末尾（提升可用性，部分站点也依赖 focus 来显示发送按钮）
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
    if (this.isQwenChat()) {
      return this.findElementWithStrategies([
        // 策略1: action bar 左侧按钮区域（最稳定）
        () => document.querySelector('.prompt-input-action-bar .action-bar-left-btns') as HTMLElement,

        // 策略2: action bar 左侧容器
        () => document.querySelector('.prompt-input-action-bar .action-bar-left') as HTMLElement,

        // 策略3: 通过输入框向上找 action bar
        () => {
          const input = this.getInputElement();
          return (input?.closest('.prompt-input-container')?.querySelector('.prompt-input-action-bar') as HTMLElement) || null;
        },
      ]);
    }

    return this.findElementWithStrategies([
      // 策略1: 获取元素span<data-icon-type="qwpcicon-sendChat"> 父元素的父元素
      () => {
        const sendButton = this.getSendButton();
        return sendButton?.parentElement?.parentElement as HTMLElement || null;
      },

      // 策略2: 通过发送按钮的父元素查找
      () => {
        const sendButton = this.getSendButton();
        return sendButton?.parentElement as HTMLElement || null;
      },

      // 策略3: 通过输入框的父容器查找
      () => {
        const input = this.getInputElement();
        if (input) {
          const form = input.closest('form');
          if (form) {
            const buttonContainer = form.querySelector('div.flex, div.button-container');
            return buttonContainer as HTMLElement || null;
          }
        }
        return null;
      },
    ]);
  }
}
