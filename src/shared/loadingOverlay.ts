/**
 * 共享的全屏 Loading 蒙版
 * 用于长耗时操作期间阻止用户操作页面，并展示进度文案。
 *
 * 视觉风格保持与 Toast 一致（cc- 前缀），CSS 在 src/styles/loadingOverlay.css。
 */

export class LoadingOverlay {
  private static readonly CLASS_NAME = 'cc-loading-overlay';
  private static el: HTMLElement | null = null;
  private static blockedKeys = ['click', 'mousedown', 'mouseup', 'dblclick', 'wheel', 'touchstart', 'touchmove', 'keydown', 'contextmenu'] as const;

  static show(message: string): void {
    if (this.el) {
      this.update(message);
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = this.CLASS_NAME;
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');

    const card = document.createElement('div');
    card.className = `${this.CLASS_NAME}__card`;

    const spinner = document.createElement('div');
    spinner.className = `${this.CLASS_NAME}__spinner`;

    const msg = document.createElement('div');
    msg.className = `${this.CLASS_NAME}__message`;
    msg.textContent = message;

    card.appendChild(spinner);
    card.appendChild(msg);
    overlay.appendChild(card);

    // 拦截所有交互事件，避免用户在加载期间点中底层页面
    this.blockedKeys.forEach((evt) => {
      overlay.addEventListener(evt, (e) => e.stopPropagation(), { capture: true });
    });

    document.body.appendChild(overlay);
    this.el = overlay;
  }

  static update(message: string): void {
    const msg = this.el?.querySelector<HTMLElement>(`.${this.CLASS_NAME}__message`);
    if (msg) { msg.textContent = message; }
  }

  static hide(): void {
    this.el?.remove();
    this.el = null;
  }
}
