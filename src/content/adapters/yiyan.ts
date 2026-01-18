/**
 * Yiyan (文心一言) Adapter
 */

import {BaseAdapter} from './base';

export class YiyanAdapter extends BaseAdapter {
  name = '文心一言';
  hostPatterns = ['yiyan.baidu.com'];

  getInputElement(): HTMLElement | null {
    // 百度一言使用可编辑div作为输入框
    return document.querySelector('div[role="textbox"][contenteditable="true"]');
  }

  getSendButton(): HTMLElement | null {
    // 支持多种发送按钮选择器
    return document.querySelector('div[class^="send__"]');
  }

  getInputValue(): string {
    const input = this.getInputElement();
    if (!input) {
      return '';
    }

    // 处理可编辑div
    if (input.contentEditable === 'true') {
      return input.textContent?.trim() || '';
    }

    // 处理textarea
    if (input instanceof HTMLTextAreaElement) {
      return input.value;
    }

    return '';
  }

  setInputValue(value: string): void {
    const input = this.getInputElement();
    if (!input) {
      return;
    }

    // 处理可编辑div
    if (input.contentEditable === 'true') {
      // 清空现有内容
      input.innerHTML = '';

      // 创建文本节点结构以匹配百度一言的格式
      const textDiv = document.createElement('div');
      textDiv.setAttribute('data-slate-node', 'element');

      const textSpan = document.createElement('span');
      textSpan.setAttribute('data-slate-node', 'text');

      const leafSpan = document.createElement('span');
      leafSpan.className = '';
      leafSpan.setAttribute('data-slate-leaf', 'true');

      const stringSpan = document.createElement('span');
      stringSpan.setAttribute('data-slate-string', 'true');
      stringSpan.textContent = value;

      leafSpan.appendChild(stringSpan);
      textSpan.appendChild(leafSpan);
      textDiv.appendChild(textSpan);
      input.appendChild(textDiv);

      // 触发输入事件
      input.dispatchEvent(new Event('input', {bubbles: true, cancelable: true}));
      input.dispatchEvent(new Event('change', {bubbles: true, cancelable: true}));

      // 设置焦点到末尾
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(input);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    // 处理textarea
    else if (input instanceof HTMLTextAreaElement) {
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
          // 查找输入框容器的兄弟元素
          const inputContainer = input.closest('div[class*="editorContainer"], div[class*="textInput"], form');
          if (inputContainer) {
            const nextSibling = inputContainer.nextElementSibling;
            if (nextSibling && nextSibling.querySelector('button, div[class*="send"]')) {
              return nextSibling as HTMLElement;
            }

            // 或查找父容器中的按钮区域
            const parent = inputContainer.parentElement;
            const buttonContainer = parent?.querySelector('div.flex, div.button-container, div[class*="toolbar"]');
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
