/**
 * Grok Adapter
 */

import { BaseAdapter } from './base';

export class GrokAdapter extends BaseAdapter {
  name = 'Grok';
  hostPatterns = ['grok.com'];

  getInputElement(): HTMLElement | null {
    // TipTap 编辑器的根节点（contenteditable 容器）
    const editor = document.querySelector<HTMLElement>('div.relative.z-10 .tiptap.ProseMirror');
    return editor ?? document.querySelector<HTMLElement>('.tiptap.ProseMirror');
  }

  getSendButton(): HTMLElement | null {
    const trigger = document.querySelector(':not(.hidden) > :not(.hidden) > #model-select-trigger');
    const grandparent = trigger?.parentElement?.parentElement;
    return grandparent?.querySelector('button.group.justify-center.rounded-full') || null;
  }

  /**
   * 获取输入框的值
   * Grok 使用 TipTap 编辑器，是 contenteditable 的 p 元素
   */
  getInputValue(): string {
    const input = this.getInputElement();
    if (!input) {
      return '';
    }
    
    // 获取 TipTap 编辑器中的所有文本内容
    const tiptapEditor = input.closest('.tiptap.ProseMirror');
    return tiptapEditor?.textContent?.trim() ?? input.textContent?.trim() ?? '';
  }

  /**
   * 设置输入框的值
   * Grok 使用 TipTap 编辑器，需要设置 textContent 并触发相应事件
   */
  setInputValue(value: string): void {
    const input = this.getInputElement();
    if (!input) {
      return;
    }

    // 获取 TipTap 编辑器容器
    const tiptapEditor = input.closest('.tiptap.ProseMirror') as HTMLElement;
    if (!tiptapEditor) {
      return;
    }

    // 清空现有内容
    tiptapEditor.innerHTML = '';
    
    // 创建新的段落元素并设置内容
    const p = document.createElement('p');
    p.textContent = value;
    tiptapEditor.appendChild(p);

    // 触发 input 事件，让 Grok 检测到内容变化
    tiptapEditor.dispatchEvent(new Event('input', { bubbles: true }));
    
    // 触发其他可能需要的编辑器事件
    tiptapEditor.dispatchEvent(new Event('change', { bubbles: true }));

    // 聚焦输入框
    tiptapEditor.focus();

    // 将光标移到末尾
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(tiptapEditor);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  /**
   * 查找按钮容器 - 使用多种策略
   */
  findButtonContainer(): HTMLElement | null {
    return this.findElementWithStrategies([
      // 策略1: 通过 z-20 容器内的 model-select-trigger 按钮查找
      () => {
        const targetButton = document.querySelector('div.z-20 button#model-select-trigger') as HTMLElement;
        return targetButton?.parentElement as HTMLElement || null;
      },

      // 策略2: 通过没有 z-20 的 model-select-trigger 查找
      () => {
        const targetButton = document.querySelector('button#model-select-trigger') as HTMLElement;
        return targetButton?.parentElement as HTMLElement || null;
      },

      // 策略3: 通过发送按钮的兄弟元素查找
      () => {
        const sendButton = this.getSendButton();
        if (sendButton) {
          // 查找同一个父容器下的模型选择器
          const parent = sendButton.closest('div.flex.items-center');
          if (parent) {
            const modelSelect = parent.querySelector('#model-select-trigger');
            if (modelSelect) {
              return modelSelect.parentElement as HTMLElement;
            }
          }
        }
        return null;
      },

      // 策略4: 通过输入框上方的工具栏查找
      () => {
        const input = this.getInputElement();
        if (input) {
          const container = input.closest('.relative.z-10');
          if (container) {
            const toolbar = container.parentElement?.querySelector('div.flex.items-center');
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
    // Grok 特定：插入到 model-select-trigger 按钮前面
    const modelSelectButton = container.querySelector('#model-select-trigger');
    if (modelSelectButton) {
      container.insertBefore(button, modelSelectButton);
    } else {
      super.insertButton(button, container);
    }
  }
}
