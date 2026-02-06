/**
 * Generic Adapter
 * 在任意页面提供基础输入框读写能力
 */

import { PlatformAdapter } from '@shared/types';

export class GenericAdapter implements PlatformAdapter {
  name = 'Generic';
  hostPatterns: string[] = [];

  getInputElement(): HTMLElement | null {
    const active = document.activeElement as HTMLElement | null;
    if (active && this.isEditableElement(active)) {
      return active;
    }

    const textarea = document.querySelector('textarea:not([disabled]):not([readonly])');
    if (textarea) {
      return textarea as HTMLElement;
    }

    const input = document.querySelector(
      'input[type="text"]:not([disabled]):not([readonly]), ' +
      'input[type="search"]:not([disabled]):not([readonly]), ' +
      'input[type="url"]:not([disabled]):not([readonly]), ' +
      'input[type="email"]:not([disabled]):not([readonly]), ' +
      'input[type="tel"]:not([disabled]):not([readonly])',
    );
    if (input) {
      return input as HTMLElement;
    }

    const editable = document.querySelector('[contenteditable="true"]');
    if (editable) {
      return editable as HTMLElement;
    }

    return null;
  }

  getSendButton(): HTMLElement | null {
    return null;
  }

  getInputValue(): string {
    const el = this.getInputElement();
    if (!el) { return ''; }
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return el.value ?? '';
    }
    return el.textContent ?? '';
  }

  setInputValue(value: string): void {
    const el = this.getInputElement();
    if (!el) { return; }

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    if (el.isContentEditable) {
      el.textContent = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  injectButton(_button: HTMLElement): void {
    // 通用页面不注入优化按钮
  }

  private isEditableElement(el: HTMLElement): boolean {
    if (el instanceof HTMLInputElement) {
      const type = (el.type || '').toLowerCase();
      if (['text', 'search', 'url', 'email', 'tel', ''].includes(type) && !el.disabled && !el.readOnly) {
        return true;
      }
    }

    if (el instanceof HTMLTextAreaElement) {
      if (!el.disabled && !el.readOnly) {
        return true;
      }
    }

    return el.isContentEditable;
  }
}
