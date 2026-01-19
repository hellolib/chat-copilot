/**
 * ChatGPT Adapter
 * 完整实现 ChatGPT 平台的适配
 */

import { BaseAdapter } from './base';

export class ChatGPTAdapter extends BaseAdapter {
  name = 'ChatGPT';
  hostPatterns = ['chatgpt.com', 'chat.openai.com'];

  private inputSelector = '#prompt-textarea';
  private sendButtonSelector = 'button[data-testid="send-button"]';
  private formSelector = 'form';

  /**
   * 获取输入框元素
   */
  getInputElement(): HTMLElement | null {
    return document.querySelector(this.inputSelector);
  }

  /**
   * 获取发送按钮
   */
  getSendButton(): HTMLElement | null {
    return document.querySelector(this.sendButtonSelector);
  }

  /**
   * 获取输入框的值
   */
  getInputValue(): string {
    const input = this.getInputElement();
    if (!input) {return '';}

    // ChatGPT 使用 contenteditable 的 div
    return input.textContent?.trim() ?? '';
  }

  /**
   * 设置输入框的值
   */
  setInputValue(value: string): void {
    const input = this.getInputElement();
    if (!input) {return;}

    // 清空现有内容
    input.innerHTML = '';

    // 创建段落元素
    const p = document.createElement('p');
    p.textContent = value;
    input.appendChild(p);

    // 触发 input 事件，让 ChatGPT 检测到内容变化
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // 聚焦输入框
    input.focus();

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
      // 策略1: 通过class名查找
      () => document.querySelector('.ms-auto.flex.items-center[class*="gap"]') as HTMLElement,

      // 策略2: 通过发送按钮查找其兄弟容器
      () => {
        const sendBtn = this.getSendButton();
        if (sendBtn) {
          // 查找发送按钮的父容器中的工具栏容器
          const form = sendBtn.closest('form');
          if (form) {
            return form.querySelector('.ms-auto.flex.items-center') as HTMLElement;
          }
        }
        return null;
      },

      // 策略3: 通过输入框查找相邻的按钮容器
      () => {
        const input = this.getInputElement();
        if (input) {
          const form = input.closest('form');
          if (form) {
            // 查找包含多个按钮的flex容器
            const containers = form.querySelectorAll('div.flex.items-center');
            for (const container of containers) {
              // 检查容器是否包含按钮
              if (container.querySelector('button') && container.children.length > 1) {
                return container as HTMLElement;
              }
            }
          }
        }
        return null;
      },
    ]);
  }

  /**
   * 自定义按钮样式（覆盖基类）
   */
  protected styleButton(button: HTMLElement): void {
    super.styleButton(button);
    // ChatGPT 特定的样式调整
    button.style.height = '32px';
    button.style.borderRadius = '16px';
  }

}
