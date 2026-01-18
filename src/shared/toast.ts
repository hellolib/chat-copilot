/**
 * 统一的 Toast 通知组件
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

export class Toast {
  private static readonly DEFAULT_DURATION = 2500;
  private static readonly CLASS_NAME = 'cc-toast';
  private static container: HTMLElement | null = null;

  static show(options: ToastOptions): void {
    const { message, type = 'info', duration = this.DEFAULT_DURATION } = options;

    this.removeExisting();

    const toast = this.create(message, type);
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('cc-toast-hiding');
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  static success(message: string, duration?: number): void {
    this.show({ message, type: 'success', duration });
  }

  static error(message: string, duration?: number): void {
    this.show({ message, type: 'error', duration });
  }

  static info(message: string, duration?: number): void {
    this.show({ message, type: 'info', duration });
  }

  static warning(message: string, duration?: number): void {
    this.show({ message, type: 'warning', duration });
  }

  private static removeExisting(): void {
    document.querySelector(`.${this.CLASS_NAME}`)?.remove();
  }

  private static create(message: string, type: ToastType): HTMLElement {
    const toast = document.createElement('div');
    toast.className = `${this.CLASS_NAME} cc-toast-${type}`;

    const icon = this.getIcon(type);

    toast.innerHTML = `
      <span class="cc-toast-icon">${icon}</span>
      <span class="cc-toast-message">${this.escapeHtml(message)}</span>
    `;

    return toast;
  }

  private static getIcon(type: ToastType): string {
    const icons = {
      success: '✓',
      error: '✕',
      info: 'ⓘ',
      warning: '⚠',
    };
    return icons[type] || icons.info;
  }

  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
