/**
 * Kimi Adapter
 */

import { BaseAdapter } from './base';

export class KimiAdapter extends BaseAdapter {
  name = 'Kimi';
  hostPatterns = ['kimi.com', 'kimi.moonshot.cn'];

  getInputElement(): HTMLElement | null {
    return this.findElementWithStrategies([
      () => document.querySelector('.chat-input-editor[contenteditable="true"]') as HTMLElement,
      () => document.querySelector('[data-lexical-editor="true"][contenteditable="true"]') as HTMLElement,
      () => document.querySelector('div[contenteditable="true"][role="textbox"]') as HTMLElement,
    ]);
  }

  getSendButton(): HTMLElement | null {
    return this.findElementWithStrategies([
      () => document.querySelector('.send-button-container') as HTMLElement,
      () => document.querySelector('.send-button-container .send-icon')?.closest('.send-button-container') as HTMLElement,
    ]);
  }

  getInputValue(): string {
    const input = this.getInputElement();
    if (!input) {
      return '';
    }

    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      return input.value ?? '';
    }

    if (input.isContentEditable) {
      return input.innerText ?? '';
    }

    return input.textContent ?? '';
  }

  setInputValue(value: string): void {
    const input = this.getInputElement();
    if (!input) {
      return;
    }

    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      const nativeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(input, value);
      } else {
        input.value = value;
      }
      this.triggerStandardEvents(input);
      input.focus();
      return;
    }

    if (input.isContentEditable) {
      input.focus();

      const success = this.setValueViaPaste(input, value);
      if (!success) {
        this.setValueViaDOMManipulation(input, value);
        this.triggerLexicalEvents(input);
      }

      this.moveCursorToEnd(input);
    }
  }

  findButtonContainer(): HTMLElement | null {
    return this.findElementWithStrategies([
      () => {
        const sendButton = this.getSendButton();
        return sendButton?.parentElement as HTMLElement || null;
      },
      () => document.querySelector('.chat-editor-action .right-area') as HTMLElement,
    ]);
  }

  protected insertButton(button: HTMLElement, container: HTMLElement): void {
    const sendButton = this.getSendButton();
    if (sendButton && container.contains(sendButton)) {
      container.insertBefore(button, sendButton);
      return;
    }

    super.insertButton(button, container);
  }

  private triggerStandardEvents(element: HTMLElement): void {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
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
        span.setAttribute('data-lexical-text', 'true');
        span.textContent = line;
        p.appendChild(span);
      } else {
        p.appendChild(document.createElement('br'));
      }
      input.appendChild(p);
    }
  }

  private triggerLexicalEvents(input: HTMLElement): void {
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
}
