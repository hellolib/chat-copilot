/**
 * Perplexity AI Adapter
 */

import { BaseAdapter } from './base';

export class PerplexityAdapter extends BaseAdapter {
  name = 'Perplexity';
  hostPatterns = ['perplexity.ai', 'www.perplexity.ai'];

  /**
   * 获取输入框元素
   * Lexical 编辑器的定位方式
   */
  getInputElement(): HTMLElement | null {
    return this.findElementWithStrategies([
      // 策略1: 通过 id="ask-input" 精确查找（最可靠）
      () => document.getElementById('ask-input') as HTMLElement,

      // 策略2: 通过 data-lexical-editor="true" 查找
      () => document.querySelector('[data-lexical-editor="true"]') as HTMLElement,

      // 策略3: 通过 contenteditable 和可能的其他属性组合
      () => document.querySelector('div[contenteditable="true"][role="textbox"]') as HTMLElement,

      // 策略4: 通用 contenteditable 回退
      () => document.querySelector('div[contenteditable="true"]') as HTMLElement,
    ]);
  }

  /**
   * 获取发送按钮
   */
  getSendButton(): HTMLElement | null {
    // Perplexity: 一个 class="ml-2 dev" 包裹了 class="reset interactable select-none" 的 button
    return this.findElementWithStrategies([
      // 策略1: 通过父容器和按钮组合查找
      () => document.querySelector('div.ml-2:has(> button.reset.interactable.select-none)') as HTMLElement,
    ]);
  }

  /**
   * 获取输入框的值
   * Lexical 编辑器的文本内容在嵌套的 <span> 中，但 textContent 会自动处理
   */
  getInputValue(): string {
    const input = this.getInputElement();
    if (!input) { return ''; }

    // 处理 textarea
    if (input instanceof HTMLTextAreaElement) {
      return input.value ?? '';
    }

    // 处理 contenteditable 的 div（Lexical 编辑器）
    if (input.isContentEditable) {
      // Lexical 编辑器的textContent会自动处理嵌套的span和br
      // 不需要trim()，保留用户输入的空格和换行
      return input.innerText ?? '';
    }

    // 处理普通 input
    return (input as HTMLInputElement).value ?? '';
  }

  /**
   * 设置输入框的值
   * Lexical 编辑器需要特殊处理以维护内部状态
   * 
   * 最佳实践：
   * 1. 使用 paste 事件模拟（最可靠的方式）
   * 2. 回退使用 DOM 操作 + 事件触发
   * 3. 确保光标定位正确
   */
  setInputValue(value: string): void {
    const input = this.getInputElement();
    if (!input) { return; }

    // 处理 textarea
    if (input instanceof HTMLTextAreaElement) {
      input.value = value;
      this.triggerInputEvents(input);
      input.focus();
      return;
    }

    // 处理普通 input
    if (input instanceof HTMLInputElement) {
      input.value = value;
      this.triggerInputEvents(input);
      input.focus();
      return;
    }

    // 处理 contenteditable 的 div（Lexical 编辑器）
    if (input.isContentEditable) {
      // 先聚焦，确保编辑器处于活动状态
      input.focus();
      // 先选中所有内容


      // 方案1: 使用 paste 事件模拟（最可靠）
      const success = this.setValueViaPaste(input, value);

      // 方案2: DOM 操作回退方案
      if (!success) {
        this.setValueViaDOMManipulation(input, value);
        this.triggerLexicalEvents(input);
      }

      // 将光标移到末尾
      this.moveCursorToEnd(input);
    }
  }

  /**
   * 使用 paste 事件模拟设置值（推荐方案）
   * 这是更新 Lexical 编辑器最可靠的方式
   */
  private setValueViaPaste(input: HTMLElement, value: string): boolean {
    try {
      console.log('Using paste event to set value...');
      const range = document.createRange();
      range.selectNodeContents(input);

      // 1. 选中所有内容
      const selection = window.getSelection();
      if (!selection) {return false;}
      selection.removeAllRanges();
      selection.addRange(range);

      // 2. 创建 ClipboardEvent 并使用 DataTransfer
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', value);

      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      });

      // 3. 触发 paste 事件
      const handled = input.dispatchEvent(pasteEvent);

      // 如果事件被处理（preventDefault 被调用），说明 Lexical 处理了粘贴
      return !handled || pasteEvent.defaultPrevented;
    } catch (error) {
      console.warn('Paste event failed:', error);
      return false;
    }
  }


  /**
   * 使用 DOM 操作设置值（方案2 - 回退方案）
   * 直接操作 DOM 结构，需要手动创建 Lexical 的 DOM 结构
   */
  private setValueViaDOMManipulation(input: HTMLElement, value: string): void {
    // 清空内容
    input.innerHTML = '';

    // 创建正确的 Lexical DOM 结构
    // Perplexity 的 Lexical 编辑器结构：
    // - 空行：<p dir="auto"><br></p>
    // - 有内容：<p dir="auto"><span data-lexical-text="true">文本</span></p>

    if (!value) {
      // 空值：创建一个空段落
      const p = document.createElement('p');
      p.setAttribute('dir', 'auto');
      p.appendChild(document.createElement('br'));
      input.appendChild(p);
      return;
    }

    // 按行分割并创建段落
    const lines = value.split('\n');

    // 如果没有内容，至少创建一个空段落
    if (lines.length === 0) {
      const p = document.createElement('p');
      p.setAttribute('dir', 'auto');
      p.appendChild(document.createElement('br'));
      input.appendChild(p);
      return;
    }

    // 为每一行创建段落
    for (const line of lines) {
      const p = document.createElement('p');
      p.setAttribute('dir', 'auto');

      if (line.trim()) {
        // 有内容的行：创建 span 包裹文本
        const span = document.createElement('span');
        span.setAttribute('data-lexical-text', 'true');
        span.textContent = line;
        p.appendChild(span);
      } else {
        // 空行：使用 br
        p.appendChild(document.createElement('br'));
      }

      input.appendChild(p);
    }
  }

  /**
   * 触发 Lexical 编辑器需要的事件
   * 需要触发足够的事件让 Lexical 识别变化，但又不能过度触发导致重复
   */
  private triggerLexicalEvents(input: HTMLElement): void {
    // 1. 先触发 beforeinput 事件（Lexical 可能监听此事件来准备更新）
    input.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
    }));

    // 2. 触发 input 事件（使用 InputEvent）
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: false,
      inputType: 'insertText',
    }));

    // 3. 使用微任务延迟触发 change 事件
    // 这样可以确保 Lexical 编辑器有时间处理 input 事件
    Promise.resolve().then(() => {
      input.dispatchEvent(new Event('change', { bubbles: true }));

      // 再次触发 input 事件，确保 Lexical 完全更新
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        inputType: 'insertText',
      }));
    });
  }

  /**
   * 触发标准输入事件（用于 textarea 和 input）
   */
  private triggerInputEvents(element: HTMLElement): void {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * 将光标移动到内容末尾
   */
  private moveCursorToEnd(input: HTMLElement): void {
    try {
      const selection = window.getSelection();
      if (!selection) {return;}

      // 确保有内容
      if (input.childNodes.length === 0) {return;}

      // 获取最后一个子节点
      const lastChild = input.childNodes[input.childNodes.length - 1];

      // 创建范围并定位到末尾
      const range = document.createRange();

      // 如果最后一个节点是元素节点（如 <p>）
      if (lastChild.nodeType === Node.ELEMENT_NODE) {
        const lastElement = lastChild as HTMLElement;

        // 如果有子节点（如 <span>），定位到最深的文本节点
        if (lastElement.childNodes.length > 0) {
          const deepestNode = this.getDeepestLastNode(lastElement);
          range.setStart(deepestNode, deepestNode.textContent?.length || 0);
          range.setEnd(deepestNode, deepestNode.textContent?.length || 0);
        } else {
          // 否则定位到元素末尾
          range.selectNodeContents(lastElement);
          range.collapse(false);
        }
      } else {
        // 文本节点，直接定位到末尾
        range.setStart(lastChild, lastChild.textContent?.length || 0);
        range.setEnd(lastChild, lastChild.textContent?.length || 0);
      }

      // 应用选区
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (error) {
      console.warn('Failed to move cursor to end:', error);
    }
  }

  /**
   * 获取元素的最深层最后一个节点（用于光标定位）
   */
  private getDeepestLastNode(element: Node): Node {
    let current = element;

    while (current.childNodes.length > 0) {
      const lastChild = current.childNodes[current.childNodes.length - 1];

      // 跳过 <br> 标签
      if (lastChild.nodeName === 'BR' && current.childNodes.length > 1) {
        current = current.childNodes[current.childNodes.length - 2];
      } else {
        current = lastChild;
      }
    }

    return current;
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
