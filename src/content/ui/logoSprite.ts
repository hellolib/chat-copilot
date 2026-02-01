export function createLogoUseSvg(className: string, size = 18): HTMLElement {
  const span = document.createElement('span');
  span.setAttribute('aria-hidden', 'true');
  span.classList.add(className);
  span.style.width = `${size}px`;
  span.style.height = `${size}px`;
  span.style.display = 'block';
  const logoUrl = chrome.runtime.getURL('assets/chat-copilot-btn.svg');
  span.style.setProperty('--cc-logo-url', `url("${logoUrl}")`);
  return span;
}
