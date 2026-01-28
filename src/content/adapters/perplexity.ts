/**
 * Perplexity AI Adapter
 */

import { BaseAdapter } from './base';

export class PerplexityAdapter extends BaseAdapter {
  name = 'Perplexity';
  hostPatterns = ['perplexity.ai', 'www.perplexity.ai'];

  private inputSelector = '.text-foreground';
  private sendButtonSelector = '.reset.interactable.select-none';

  /**
   * 获取输入框元素
   */
  getInputElement(): HTMLElement | null {
    return this.findElementWithStrategies([
      // 策略1: 通过 class="text-foreground" 直接查找
      () => document.querySelector('div.text-foreground.bg-transparent') as HTMLElement,

      // 策略2: 查找可能的其他文本输入元素
      () => document.querySelector('textarea, div[contenteditable="true"]') as HTMLElement,
    ]);
  }

  /**
   * 获取发送按钮
   */
  getSendButton(): HTMLElement | null {
    // Perplexity: 一个 class="ml-2 dev" 包裹了 class="reset interactable select-none" 的 button
    return this.findElementWithStrategies([
      // 策略1: 通过按钮 class 直接查找
      () => document.querySelector(  'div.ml-2:has(> button.reset.interactable.select-none)') as HTMLElement,
    ]);
  }

  /**
   * 获取输入框的值
   */
  getInputValue(): string {
    const input = this.getInputElement();
    if (!input) {return '';}

    // 处理不同类型的输入元素
    if (input instanceof HTMLTextAreaElement) {
      return input.value ?? '';
    }

    // 处理 contenteditable 的 div
    if (input.isContentEditable) {
      return input.textContent?.trim() ?? '';
    }

    return input.getAttribute('value') ?? '';
  }

  /**
   * 设置输入框的值
   */
  setInputValue(value: string): void {
    const input = this.getInputElement();
    if (!input) {return;}

    // 处理 textarea
    if (input instanceof HTMLTextAreaElement) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.focus();
      return;
    }

    // 处理 contenteditable 的 div
    if (input.isContentEditable) {
      input.focus();
      input.textContent = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    // 处理普通输入框
    (input as HTMLInputElement).value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
  }

  /**
   * 查找按钮容器
   * 按钮注入方式是：发送按钮的父级盒子的第一个元素
   */
  findButtonContainer(): HTMLElement | null {
    return this.findElementWithStrategies([
      // 策略1: 通过发送按钮查找其父容器
      () => {
        const sendBtn = this.getSendButton();
        if (sendBtn && sendBtn.parentElement) {
          // 返回发送按钮的父容器
          return sendBtn.parentElement as HTMLElement;
        }
        return null;
      },

      // 策略2: 通过 class="ml-2 dev" 查找容器
      () => document.querySelector('.ml-2.dev') as HTMLElement,

      // 策略3: 通过输入框查找附近的按钮容器
      () => {
        const input = this.getInputElement();
        if (input && input.parentElement) {
          // 查找包含 class="ml-2" 的容器
          const mlContainer = input.parentElement.querySelector('[class*="ml-2"]');
          if (mlContainer) {
            return mlContainer as HTMLElement;
          }
        }
        return null;
      },

      // 策略4: 查找包含按钮的 flex 容器
      () => {
        const buttons = document.querySelectorAll('button.reset.interactable.select-none');
        for (const btn of buttons) {
          if (btn.parentElement) {
            return btn.parentElement as HTMLElement;
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
    // Perplexity 特定的样式调整
    button.style.cursor = 'pointer';
    button.style.display = 'inline-flex';
    button.style.alignItems = 'center';
  }
}
