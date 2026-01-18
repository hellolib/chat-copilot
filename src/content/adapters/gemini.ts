/**
 * Gemini Adapter
 */

import { BaseAdapter } from './base';

export class GeminiAdapter extends BaseAdapter {
  name = 'Gemini';
  hostPatterns = ['gemini.google.com'];

  getInputElement(): HTMLElement | null {
    // Gemini currently uses Quill inside <rich-textarea>, the real editable is `.ql-editor`.
    // IMPORTANT: Do not return the <rich-textarea> itself; writing to its `textContent`
    // will wipe its children and break the input (click/focus + send button state).
    return (
      document.querySelector('rich-textarea .ql-editor[contenteditable="true"]') ||
      // Fallback for older/alternate UI
      document.querySelector('textarea[aria-label*="prompt" i], .initial-input-area-container textarea')
    );
  }

  getSendButton(): HTMLElement | null {
    return document.querySelector('button.send-button');
  }

  getInputValue(): string {
    const input = this.getInputElement();
    if (!input) {return '';}

    if (input instanceof HTMLTextAreaElement) {
      return input.value ?? '';
    }

    return input.textContent ?? '';
  }

  setInputValue(value: string): void {
    const input = this.getInputElement();
    if (!input) {return;}

    // textarea-based UI
    if (input instanceof HTMLTextAreaElement) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.focus();
      return;
    }

    // contenteditable (Quill)
    input.focus();

    // Prefer execCommand so Quill/Angular can observe a "real" edit and enable the send button.
    // Fallback to DOM writes if execCommand is blocked.
    let usedExecCommand = false;
    try {
      document.execCommand('selectAll');
      document.execCommand('delete');
      if (value) {
        document.execCommand('insertText', false, value);
      }
      usedExecCommand = true;
    } catch {
      usedExecCommand = false;
    }

    if (!usedExecCommand) {
      // Fallback: keep Quill's expected structure (<p>…</p>)
      input.innerHTML = '';
      const lines = value.split('\n');
      for (const line of lines) {
        const p = document.createElement('p');
        if (line) {
          p.textContent = line;
        } else {
          p.appendChild(document.createElement('br'));
        }
        input.appendChild(p);
      }
    }

    input.classList.toggle('ql-blank', value.trim().length === 0);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
  }

  /**
   * 查找按钮容器 - 使用多种策略
   */
  findButtonContainer(): HTMLElement | null {
    return this.findElementWithStrategies([
      // 策略1: 通过 model-picker-container 类名查找
      () => document.querySelector('div.model-picker-container') as HTMLElement,

      // 策略2: 通过模型选择器按钮查找
      () => {
        // 查找可能的模型选择器按钮
        const buttons = document.querySelectorAll('button[aria-haspopup="menu"], button[role="button"]');
        for (const btn of buttons) {
          if (btn.textContent && btn.textContent.includes('Gemini')) {
            return btn.parentElement as HTMLElement || null;
          }
        }
        return null;
      },

      // 策略3: 通过输入框上方的工具栏查找
      () => {
        const input = this.getInputElement();
        if (input) {
          // 在 Gemini 中，工具栏通常在输入框上方
          const parent = input.closest('.input-area-container, .prompt-container');
          if (parent) {
            const toolbar = parent.querySelector('.toolbar, .actions-container, div.flex.items-center');
            return toolbar as HTMLElement || null;
          }
        }
        return null;
      },

      // 策略4: 通过发送按钮附近查找
      () => {
        const sendBtn = this.getSendButton();
        if (sendBtn && sendBtn.parentElement) {
          // 查找同级或父级的工具栏
          const parent = sendBtn.parentElement.parentElement;
          if (parent) {
            const toolbar = parent.querySelector('div.flex.items-center');
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
    // Gemini 特定：插入到父容器的目标div前面
    if (container.parentElement) {
      container.parentElement.insertBefore(button, container);
    } else {
      super.insertButton(button, container);
    }
  }
}
