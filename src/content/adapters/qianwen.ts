/**
 * Qianwen Web (通义千问网页端) Adapter
 */

import { BaseAdapter } from './base';

export class QianwenAdapter extends BaseAdapter {
  name = '通义千问';
  hostPatterns = ['www.qianwen.com'];

  private readonly SEND_BUTTON_SELECTORS = {
    qwenWeb: ['span[data-icon-type="qwpcicon-sendChat"]'],
  };

  getInputElement(): HTMLElement | null {
    return document.querySelector('textarea[placeholder]')
      || document.querySelector('div[data-slate-editor="true"][contenteditable="true"]');
  }

  getSendButton(): HTMLElement | null {
    for (const selector of this.SEND_BUTTON_SELECTORS.qwenWeb) {
      const element = document.querySelector(selector);
      if (element) {
        return element as HTMLElement;
      }
    }

    return null;
  }

  getInputValue(): string {
    const input = this.getInputElement();
    if (!input) { return ''; }

    if (input instanceof HTMLTextAreaElement) {
      return input.value ?? '';
    }

    return (input.textContent ?? '').trim();
  }

  setInputValue(value: string): void {
    const input = this.getInputElement();
    if (!input) {return;}

    if (input instanceof HTMLTextAreaElement) {
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
      return;
    }

    if (input.isContentEditable) {
      input.focus();

      const success = this.setValueViaPaste(input, value);
      if (!success) {
        this.setValueViaDOMManipulation(input, value);
        this.triggerSlateEvents(input);
      }

      this.moveCursorToEnd(input);
      return;
    }

    input.textContent = value;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('keyup', { bubbles: true }));
  }

  private setValueViaPaste(input: HTMLElement, value: string): boolean {
    try {
      const range = document.createRange();
      range.selectNodeContents(input);
      const selection = window.getSelection();
      if (!selection) {
        return false;
      }
      selection.removeAllRanges();
      selection.addRange(range);

      const beforeInputEvent = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertFromPaste',
        data: value,
      });
      input.dispatchEvent(beforeInputEvent);

      if (!beforeInputEvent.defaultPrevented) {
        this.setValueViaDOMManipulation(input, value);
      }

      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        inputType: 'insertFromPaste',
        data: value,
      });
      input.dispatchEvent(inputEvent);

      return true;
    } catch (error) {
      this.logWarning('Failed to set value via paste', error);
      return false;
    }
  }

  private setValueViaDOMManipulation(input: HTMLElement, value: string): void {
    input.innerHTML = '';

    if (!value) {
      const p = document.createElement('p');
      p.appendChild(document.createElement('br'));
      input.appendChild(p);
      return;
    }

    const lines = value.split('\n');
    if (lines.length === 0) {
      const p = document.createElement('p');
      p.appendChild(document.createElement('br'));
      input.appendChild(p);
      return;
    }

    for (const line of lines) {
      const p = document.createElement('p');
      if (line.trim()) {
        const span = document.createElement('span');
        span.setAttribute('data-slate-string', 'true');
        span.textContent = line;
        p.appendChild(span);
      } else {
        p.appendChild(document.createElement('br'));
      }
      input.appendChild(p);
    }
  }

  private triggerSlateEvents(input: HTMLElement): void {
    input.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
      }),
    );

    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        inputType: 'insertText',
      }),
    );

    Promise.resolve().then(() => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: false,
          inputType: 'insertText',
        }),
      );
    });
  }

  private moveCursorToEnd(input: HTMLElement): void {
    try {
      const selection = window.getSelection();
      if (!selection || input.childNodes.length === 0) {
        return;
      }

      const lastChild = input.childNodes[input.childNodes.length - 1];
      const range = document.createRange();

      if (lastChild.nodeType === Node.ELEMENT_NODE) {
        const lastElement = lastChild as HTMLElement;
        if (lastElement.childNodes.length > 0) {
          const deepestNode = this.getDeepestLastNode(lastElement);
          range.setStart(deepestNode, deepestNode.textContent?.length || 0);
          range.setEnd(deepestNode, deepestNode.textContent?.length || 0);
        } else {
          range.selectNodeContents(lastElement);
          range.collapse(false);
        }
      } else {
        range.setStart(lastChild, lastChild.textContent?.length || 0);
        range.setEnd(lastChild, lastChild.textContent?.length || 0);
      }

      selection.removeAllRanges();
      selection.addRange(range);
    } catch (error) {
      this.logWarning('Failed to move cursor to end', error);
    }
  }

  private getDeepestLastNode(element: Node): Node {
    let current = element;

    while (current.childNodes.length > 0) {
      const lastChild = current.childNodes[current.childNodes.length - 1];
      if (lastChild.nodeName === 'BR' && current.childNodes.length > 1) {
        current = current.childNodes[current.childNodes.length - 2];
      } else {
        current = lastChild;
      }
    }

    return current;
  }

  /**
   * 查找按钮容器 - 使用多种策略
   */
  findButtonContainer(): HTMLElement | null {
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
