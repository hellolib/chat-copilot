/**
 * Clipboard Export Strategy
 * Exports conversations by clicking platforms' native "Copy" buttons
 * and reading perfectly formatted Markdown from the clipboard.
 */

import { ExportChatData, ExportConfig } from './config';
import { ExportResult } from './engine';
import { formatFileName } from './filename';
import { BACK_TO_TOP_LINK, truncate, escapeMd, formatLocalTime } from './utils';
import { ensureDeepSeekMessagesMounted } from '../adapters/deepseek';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Per-platform contract for the clipboard export path.
 * Each platform exposes how to enumerate AI turns and how to locate
 * the copy button inside one (which may require a hover to mount).
 */
export interface ClipboardStrategy {
  platform: string;
  /** Optional: prepare DOM (e.g. mount virtual-list nodes) before enumeration */
  prepare?(): Promise<void>;
  /** Return assistant turn elements in DOM order (must align with chatData assistant messages) */
  getAssistantTurns(): HTMLElement[];
  /** Locate the copy button inside an assistant turn, optionally triggering hover first */
  findCopyButton(turn: HTMLElement): Promise<HTMLElement | null>;
}

// ---- ChatGPT strategy ----
const CHATGPT_TURN_SELECTOR = 'article[data-testid^="conversation-turn-"]';
const CHATGPT_COPY_BUTTON_SELECTOR = 'button[data-testid="copy-turn-action-button"]';

const chatgptStrategy: ClipboardStrategy = {
  platform: 'ChatGPT',
  getAssistantTurns() {
    // Filter to turns that actually expose a copy button — these are AI turns.
    return Array.from(document.querySelectorAll<HTMLElement>(CHATGPT_TURN_SELECTOR))
      .filter((t) => t.querySelector(CHATGPT_COPY_BUTTON_SELECTOR));
  },
  async findCopyButton(turn) {
    return turn.querySelector<HTMLElement>(CHATGPT_COPY_BUTTON_SELECTOR);
  },
};

// ---- DeepSeek strategy ----
// SVG path "d" prefix uniquely identifying the copy icon. The class names
// (db183363/ds-icon-button) and aria-* are identical across copy / regen / etc.,
// so the icon path is the only stable discriminator.
const DEEPSEEK_COPY_PATH_PREFIX = 'M6.14929 4.02032';
const DEEPSEEK_ASSISTANT_SELECTOR = '.ds-markdown.ds-assistant-message-main-content';

const deepseekStrategy: ClipboardStrategy = {
  platform: 'DeepSeek',
  /**
   * 导出前再滚动一次让虚拟列表挂载所有消息。
   * 即便 ExportDialog.open 已经调过 adapter.prepareForExport，
   * 用户在 dialog 里勾选/搜索过程中虚拟列表可能已回收节点；
   * 这里再保险一次，确保循环里每条 assistant 都能找到 turn。
   */
  async prepare() {
    await ensureDeepSeekMessagesMounted();
  },
  getAssistantTurns() {
    return Array.from(document.querySelectorAll<HTMLElement>(DEEPSEEK_ASSISTANT_SELECTOR));
  },
  async findCopyButton(turn) {
    // Action bar lives as a sibling within the same virtual-list item.
    const item =
      turn.closest<HTMLElement>('[data-virtual-list-item-key]') ||
      turn.closest<HTMLElement>('.ds-message')?.parentElement ||
      turn.parentElement;
    if (!item) { return null; }

    // 若该 turn 不在视口内，先滚到可见范围 — DeepSeek 虚拟列表会回收远离视口的节点。
    item.scrollIntoView({ block: 'center', behavior: 'auto' });
    await sleep(120);

    // DeepSeek shows the action bar only on hover. Buttons may be either
    // CSS-hidden (already in DOM) or mounted on hover — fire mouseenter
    // to cover both cases, then look up by SVG path fingerprint.
    item.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(80);

    const buttons = item.querySelectorAll<HTMLElement>('.ds-icon-button');
    for (const btn of buttons) {
      const d = btn.querySelector('path')?.getAttribute('d') ?? '';
      if (d.startsWith(DEEPSEEK_COPY_PATH_PREFIX)) { return btn; }
    }
    return null;
  },
};

const STRATEGIES: Record<string, ClipboardStrategy> = {
  ChatGPT: chatgptStrategy,
  DeepSeek: deepseekStrategy,
};

/**
 * Whether a platform supports the clipboard export path.
 */
export function isClipboardSupported(platform: string): boolean {
  return platform in STRATEGIES;
}

/**
 * Click the platform's copy button and read the clipboard to get Markdown.
 * Retries up to 10 times if the clipboard is empty.
 */
async function copyModelResponse(copyButton: HTMLElement): Promise<string> {
  // Clear clipboard first
  try {
    await navigator.clipboard.writeText('');
  } catch {
    // Ignore clipboard clear errors
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    copyButton.click();
    await sleep(300);
    try {
      const text = await navigator.clipboard.readText();
      if (text) { return text; }
    } catch {
      // Permission denied or API error — break early
      break;
    }
    await sleep(150);
    // Re-clear clipboard before retry
    try { await navigator.clipboard.writeText(''); } catch { /* ignore */ }
  }

  return '';
}

/**
 * Build a Markdown placeholder string when copy fails.
 */
function buildAssistantPlaceholder(index: number): string {
  return `## chat-${index}\n\n_[Content unavailable]_\n\n${BACK_TO_TOP_LINK}`;
}

/**
 * Export chat via clipboard — uses the platform-specific strategy to click
 * each AI message's native copy button and assemble the Markdown.
 */
export async function exportViaClipboard(
  chatData: ExportChatData,
  config: ExportConfig,
): Promise<ExportResult> {
  const strategy = STRATEGIES[chatData.platform];
  if (!strategy) {
    throw new Error(`Clipboard export is not implemented for platform: ${chatData.platform}`);
  }

  // Phase 2 预热：确保虚拟列表平台的全部消息节点都挂在 DOM
  if (strategy.prepare) {
    try {
      await strategy.prepare();
    } catch (error) {
      console.warn(`[Chat Copilot] ${strategy.platform} clipboard prepare failed:`, error);
    }
  }

  const turns = strategy.getAssistantTurns();
  if (turns.length === 0) {
    throw new Error('No conversation turns found on page. The page may not have finished loading.');
  }

  let aiIndex = 0;
  let toc = '';
  let content = '';
  let exportChatIndex = 0;

  for (const msg of chatData.messages) {
    if (msg.role === 'user') {
      exportChatIndex++;
      const preview = truncate(msg.contentText.replace(/\s+/g, ' '), 70);
      toc += `- [${exportChatIndex}: ${escapeMd(preview)}](#chat-${exportChatIndex})\n`;
      content += `## chat-${exportChatIndex}\n\n> ${msg.contentText.replace(/\n/g, '\n> ')}\n\n`;
    } else {
      const turn = turns[aiIndex];
      aiIndex++;

      let markdownContent = '';
      if (turn) {
        const copyBtn = await strategy.findCopyButton(turn);
        if (copyBtn) {
          markdownContent = await copyModelResponse(copyBtn);
        }
      }

      if (markdownContent) {
        content += markdownContent + '\n\n' + BACK_TO_TOP_LINK;
      } else {
        content += buildAssistantPlaceholder(exportChatIndex);
      }
    }
  }

  const localTime = formatLocalTime(chatData.exportedAt);

  let finalOutput = '';

  if (config.includeFrontMatter) {
    finalOutput += `---\ntitle: "${chatData.title.replace(/"/g, '\\"')}"\nauthor: ${chatData.platform}\ncount: ${chatData.messageCount}\ndate: ${localTime}\nurl: ${chatData.threadUrl}\n---\n\n`;
  }

  finalOutput += `# ${chatData.title}\n\n`;

  if (config.includeTOC) {
    finalOutput += `## Table of Contents\n\n${toc.trim()}\n\n`;
  }

  finalOutput += content.trim() + '\n\n';

  const fileName = formatFileName(
    config.filenameTemplate,
    chatData.title,
    chatData.platform,
    [],
    'md',
  );

  return { output: finalOutput, fileName };
}
