/**
 * Floating Button
 * 右侧悬浮按钮逻辑
 */

import { ErrorHandler } from '@shared/errors';

type FloatingButtonPosition = {
  side: 'left' | 'right';
  top: number;
  topRatio?: number;
};

type FloatingButtonAction = {
  id: string;
  label: string;
  onClick: () => void;
};

type FloatingButtonOptions = {
  getExtensionURL: (path: string) => string;
  onClick: () => void;
  actions: FloatingButtonAction[];
};

export class FloatingButton {
  private options: FloatingButtonOptions;
  private wrapper: HTMLElement | null = null;
  private button: HTMLButtonElement | null = null;
  private dragOffset = { x: 0, y: 0 };
  private dragMoved = false;
  private dragStart = { x: 0, y: 0 };
  private snapTimer: ReturnType<typeof setTimeout> | null = null;
  private isPointerDown = false;
  private isDragging = false;

  constructor(options: FloatingButtonOptions) {
    this.options = options;
  }

  init(): void {
    const existing = document.querySelector('.chat-copilot-floating-wrapper') as HTMLElement | null;
    if (existing) {
      this.wrapper = existing;
      this.button = existing.querySelector('.chat-copilot-floating-btn') as HTMLButtonElement | null;
      return;
    }
    const wrapper = this.createWrapper();
    document.body.appendChild(wrapper);
    this.wrapper = wrapper;
    this.button = wrapper.querySelector('.chat-copilot-floating-btn') as HTMLButtonElement | null;
    void this.restorePosition(wrapper);
  }

  refresh(): void {
    if (!this.wrapper || !document.contains(this.wrapper)) {
      this.init();
    }
  }

  setVisible(visible: boolean): void {
    if (!visible) {
      if (this.wrapper) {
        this.wrapper.style.display = 'none';
      }
      return;
    }

    if (!this.wrapper || !document.contains(this.wrapper)) {
      this.init();
    }

    if (this.wrapper) {
      this.wrapper.style.display = '';
    }
  }

  private createWrapper(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-copilot-floating-wrapper';

    const button = document.createElement('button');
    button.className = 'chat-copilot-floating-btn';
    button.type = 'button';
    button.setAttribute('aria-label', 'chat copilot');

    const defaultIconUrl = this.options.getExtensionURL('assets/chat-copilot-btn-no-light.svg');
    const hoverIconUrl = this.options.getExtensionURL('assets/chat-copilot-btn.svg');

    if (defaultIconUrl) {
      const icon = document.createElement('img');
      icon.className = 'chat-copilot-floating-icon';
      icon.src = defaultIconUrl;
      icon.alt = 'chat copilot';
      icon.draggable = false;
      const fallback = document.createElement('span');
      fallback.className = 'chat-copilot-floating-fallback';
      fallback.textContent = 'CC';
      fallback.style.display = 'none';
      icon.onerror = () => {
        icon.remove();
        fallback.style.display = 'block';
      };
      button.appendChild(icon);
      button.appendChild(fallback);

      button.addEventListener('mouseenter', () => {
        if (hoverIconUrl) {
          icon.src = hoverIconUrl;
        }
      });

      button.addEventListener('mouseleave', () => {
        if (!wrapper.classList.contains('drawer-open') && defaultIconUrl) {
          icon.src = defaultIconUrl;
        }
      });
    } else {
      const fallback = document.createElement('span');
      fallback.className = 'chat-copilot-floating-fallback';
      fallback.textContent = 'CC';
      button.appendChild(fallback);
    }

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.dragMoved) {
        this.dragMoved = false;
        return;
      }
      this.options.onClick();
    });

    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {return;}
      event.preventDefault();
      event.stopPropagation();
      if (this.snapTimer) {
        clearTimeout(this.snapTimer);
        this.snapTimer = null;
      }
      wrapper.classList.remove('drawer-open');
      this.dragMoved = false;
      this.dragStart = {
        x: event.clientX,
        y: event.clientY,
      };
      this.isPointerDown = true;
      this.isDragging = false;
      wrapper.classList.add('dragging-ready');
      button.setPointerCapture(event.pointerId);
    });

    button.addEventListener('pointermove', (event) => {
      if (!this.isPointerDown) {return;}
      event.preventDefault();
      const movedX = Math.abs(event.clientX - this.dragStart.x);
      const movedY = Math.abs(event.clientY - this.dragStart.y);

      if (!this.isDragging) {
        if (movedX <= 3 && movedY <= 3) {
          return;
        }
        const rect = wrapper.getBoundingClientRect();
        this.dragOffset = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        this.isDragging = true;
        this.dragMoved = true;
        wrapper.classList.add('dragging', 'floating-custom-position');
        wrapper.style.right = 'auto';
        wrapper.style.left = `${rect.left}px`;
        wrapper.style.bottom = 'auto';
        wrapper.style.top = `${rect.top}px`;
      }

      const maxLeft = window.innerWidth - wrapper.offsetWidth;
      const maxTop = window.innerHeight - wrapper.offsetHeight;
      let left = event.clientX - this.dragOffset.x;
      let top = event.clientY - this.dragOffset.y;
      left = Math.min(Math.max(0, left), maxLeft);
      top = Math.min(Math.max(0, top), maxTop);
      wrapper.style.right = 'auto';
      wrapper.style.left = `${left}px`;
      wrapper.style.top = `${top}px`;
    });

    const endDrag = (event: PointerEvent) => {
      if (!this.isPointerDown) {return;}
      this.isPointerDown = false;
      wrapper.classList.remove('dragging-ready');
      if (this.isDragging) {
        this.isDragging = false;
        wrapper.classList.remove('dragging');
        const rect = wrapper.getBoundingClientRect();
        const maxTop = Math.max(0, window.innerHeight - wrapper.offsetHeight);
        const clampedTop = Math.min(Math.max(0, rect.top), maxTop);
        const edgeOffset = this.getEdgeOffset();
        const side: 'left' | 'right' = rect.left + rect.width / 2 < window.innerWidth / 2 ? 'left' : 'right';

        wrapper.classList.add('snapping', 'floating-custom-position');
        wrapper.style.top = `${clampedTop}px`;
        wrapper.style.bottom = 'auto';
        if (side === 'left') {
          wrapper.style.left = `${edgeOffset}px`;
          wrapper.style.right = 'auto';
        } else {
          wrapper.style.right = `${edgeOffset}px`;
          wrapper.style.left = 'auto';
        }

        if (this.snapTimer) {
          clearTimeout(this.snapTimer);
        }
        this.snapTimer = setTimeout(() => {
          wrapper.classList.remove('snapping');
          this.snapTimer = null;
        }, 220);

        const topRatio = maxTop > 0 ? clampedTop / maxTop : 0;
        void this.savePosition({ side, top: clampedTop, topRatio });
        if (this.dragMoved) {
          setTimeout(() => {
            this.dragMoved = false;
          }, 0);
        }
      }
      button.releasePointerCapture(event.pointerId);
    };

    button.addEventListener('pointerup', endDrag);
    button.addEventListener('pointercancel', endDrag);

    const drawer = document.createElement('div');
    drawer.className = 'chat-copilot-floating-drawer';
    this.options.actions.forEach((action) => {
      const actionButton = document.createElement('button');
      actionButton.type = 'button';
      actionButton.className = 'chat-copilot-floating-action';
      actionButton.setAttribute('aria-label', action.label);
      actionButton.appendChild(this.createActionIcon(action.id));
      const actionTooltip = document.createElement('span');
      actionTooltip.className = 'chat-copilot-floating-tooltip chat-copilot-floating-action-tooltip';
      actionTooltip.textContent = action.label;
      actionButton.appendChild(actionTooltip);
      actionButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        action.onClick();
      });
      drawer.appendChild(actionButton);
    });

    const tooltip = document.createElement('span');
    tooltip.className = 'chat-copilot-floating-tooltip';
    tooltip.textContent = 'chat copilot';

    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    const resetIcon = () => {
      if (!defaultIconUrl) {return;}
      const icon = wrapper.querySelector('.chat-copilot-floating-icon') as HTMLImageElement | null;
      if (icon) {
        icon.src = defaultIconUrl;
      }
    };
    const closeDrawer = () => {
      wrapper.classList.remove('drawer-open');
      wrapper.classList.remove('drawer-open-down');
      resetIcon();
    };
    const openDrawer = () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      const wrapperRect = wrapper.getBoundingClientRect();
      const drawerHeight = drawer.offsetHeight;
      const spacing = 10;
      if (wrapperRect.top - drawerHeight - spacing < 8) {
        wrapper.classList.add('drawer-open-down');
      } else {
        wrapper.classList.remove('drawer-open-down');
      }
      wrapper.classList.add('drawer-open');
      if (hoverIconUrl) {
        const icon = wrapper.querySelector('.chat-copilot-floating-icon') as HTMLImageElement | null;
        if (icon) {
          icon.src = hoverIconUrl;
        }
      }
    };
    const scheduleClose = () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
      }
      closeTimer = setTimeout(() => {
        closeDrawer();
        closeTimer = null;
      }, 120);
    };

    button.addEventListener('mouseenter', openDrawer);
    button.addEventListener('mouseleave', scheduleClose);
    drawer.addEventListener('mouseenter', () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    });
    drawer.addEventListener('mouseleave', () => {
      if (!wrapper.classList.contains('dragging') && !wrapper.classList.contains('dragging-ready')) {
        closeDrawer();
      }
    });

    wrapper.appendChild(button);
    wrapper.appendChild(tooltip);
    wrapper.appendChild(drawer);
    return wrapper;
  }

  private createActionIcon(id: string): SVGElement {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    if (id === 'optimize') {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M12 3l2.2 5.4L20 10l-5.8 1.6L12 17l-2.2-5.4L4 10l5.8-1.6L12 3z');
      const sparkle = document.createElementNS(svgNS, 'path');
      sparkle.setAttribute('d', 'M19 3l.7 1.8L21.5 5l-1.8.7L19 7.5l-.7-1.8L16.5 5l1.8-.7L19 3z');
      svg.appendChild(path);
      svg.appendChild(sparkle);
      return svg;
    }

    if (id === 'prompt-plaza') {
      const rects = [
        { x: 4, y: 4 },
        { x: 14, y: 4 },
        { x: 4, y: 14 },
        { x: 14, y: 14 },
      ];
      rects.forEach((rect) => {
        const el = document.createElementNS(svgNS, 'rect');
        el.setAttribute('x', rect.x.toString());
        el.setAttribute('y', rect.y.toString());
        el.setAttribute('width', '6');
        el.setAttribute('height', '6');
        el.setAttribute('rx', '1.2');
        svg.appendChild(el);
      });
      return svg;
    }

    const line1 = document.createElementNS(svgNS, 'path');
    line1.setAttribute('d', 'M4 7h16');
    const line2 = document.createElementNS(svgNS, 'path');
    line2.setAttribute('d', 'M4 17h16');
    const knob1 = document.createElementNS(svgNS, 'circle');
    knob1.setAttribute('cx', '9');
    knob1.setAttribute('cy', '7');
    knob1.setAttribute('r', '2');
    const knob2 = document.createElementNS(svgNS, 'circle');
    knob2.setAttribute('cx', '15');
    knob2.setAttribute('cy', '17');
    knob2.setAttribute('r', '2');
    svg.appendChild(line1);
    svg.appendChild(line2);
    svg.appendChild(knob1);
    svg.appendChild(knob2);
    return svg;
  }

  private getEdgeOffset(): number {
    return window.innerWidth <= 480 ? 10 : 20;
  }

  private async restorePosition(wrapper: HTMLElement): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['floatingButtonPosition']);
      const position = result.floatingButtonPosition as FloatingButtonPosition | undefined;
      if (!position) {return;}

      const maxTop = Math.max(0, window.innerHeight - wrapper.offsetHeight);
      const top = typeof position.topRatio === 'number'
        ? position.topRatio * maxTop
        : position.top;
      const clampedTop = Math.min(Math.max(0, top), maxTop);
      const edgeOffset = this.getEdgeOffset();

      wrapper.classList.add('floating-custom-position');
      wrapper.style.top = `${clampedTop}px`;
      wrapper.style.bottom = 'auto';

      if (position.side === 'left') {
        wrapper.style.left = `${edgeOffset}px`;
        wrapper.style.right = 'auto';
      } else {
        wrapper.style.right = `${edgeOffset}px`;
        wrapper.style.left = 'auto';
      }
    } catch (error) {
      ErrorHandler.logError(error, 'restoreFloatingButtonPosition');
    }
  }

  private async savePosition(position: FloatingButtonPosition): Promise<void> {
    try {
      await chrome.storage.local.set({ floatingButtonPosition: position });
    } catch (error) {
      ErrorHandler.logError(error, 'saveFloatingButtonPosition');
    }
  }
}
