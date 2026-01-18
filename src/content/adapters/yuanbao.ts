/**
 * Yuanbao (元宝) Adapter
 */

import {BaseAdapter} from './base';

export class YuanbaoAdapter extends BaseAdapter {
  name = '元宝';
  hostPatterns = ['yuanbao.tencent.com'];

  getInputElement(): HTMLElement | null {
    // 元宝使用 contenteditable div 作为输入框
    return document.querySelector('div.ql-editor[contenteditable="true"]');
  }

  getSendButton(): HTMLElement | null {
    // 查找发送按钮（可能在输入框附近的按钮容器内）
    return document.getElementById('yuanbao-send-btn');
  }

  getInputValue(): string {
    const input = this.getInputElement();
    if (!input) {return '';}

    // 获取 contenteditable 内容，去除 HTML 标签
    return input.textContent || '';
  }

  setInputValue(value: string): void {
    const input = this.getInputElement();
    if (!input) {return;}

    // 清空现有内容
    input.innerHTML = '';

    // 将文本按行分割，创建段落
    const lines = value.split('\n');
    lines.forEach((line, _) => {
      const p = document.createElement('p');
      p.textContent = line || '\u200B'; // 使用零宽空格避免空段落
      input.appendChild(p);
    });

    // 触发 input 事件
    input.dispatchEvent(new Event('input', {bubbles: true}));

    // 将光标移到末尾
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
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
