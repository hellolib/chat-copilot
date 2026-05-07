/**
 * Clipboard Export Strategy
 * Exports ChatGPT conversations by clicking the native "Copy" button
 * and reading perfectly formatted Markdown from the clipboard.
 */

import { ExportChatData, ExportConfig } from './config';
import { ExportResult } from './engine';
import { formatFileName } from './filename';

const COPY_BUTTON_SELECTOR = 'button[data-testid="copy-turn-action-button"]';
const TURN_SELECTOR = 'article[data-testid^="conversation-turn-"]';
const SLEEP_MS = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Click ChatGPT's copy button and read the clipboard to get Markdown.
 * Retries up to 10 times if clipboard is empty.
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
    await SLEEP_MS(300);
    try {
      const text = await navigator.clipboard.readText();
      if (text) return text;
    } catch {
      // Permission denied or API error — break early
      break;
    }
    await SLEEP_MS(150);
    // Re-clear clipboard before retry
    try { await navigator.clipboard.writeText(''); } catch { /* ignore */ }
  }

  return '';
}

/**
 * Build a Markdown string for AI responses, filling in the content later.
 * Returns a placeholder text for when copy fails.
 */
function buildAssistantPlaceholder(index: number): string {
  return `## chat-${index}\n\n_[Content unavailable]_\n\n___\n###### [top](#table-of-contents)\n`;
}

/**
 * Export chat via clipboard — clicks native ChatGPT copy buttons
 * for each AI message and reads the resulting Markdown.
 */
export async function exportViaClipboard(
  chatData: ExportChatData,
  config: ExportConfig,
): Promise<ExportResult> {
  // Collect all article sections on the page
  const sections = document.querySelectorAll<HTMLElement>(TURN_SELECTOR);
  if (sections.length === 0) {
    throw new Error('No conversation turns found on page. The page may not have finished loading.');
  }

  // Build a map: message index -> copy button (AI messages only)
  const sectionList = Array.from(sections);
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
      // Find the corresponding article section and its copy button
      const matchingSection = sectionList[aiIndex];
      aiIndex++;

      let markdownContent = '';
      if (matchingSection) {
        const copyBtn = matchingSection.querySelector<HTMLElement>(COPY_BUTTON_SELECTOR);
        if (copyBtn) {
          markdownContent = await copyModelResponse(copyBtn);
        }
      }

      if (markdownContent) {
        content += markdownContent + '\n\n___\n###### [top](#table-of-contents)\n';
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

// --- Utilities (mirror engine.ts utilities) ---

function truncate(str: string, len = 70): string {
  return str.length <= len ? str : str.slice(0, len).trim() + '...';
}

function escapeMd(text: string): string {
  return text.replace(/[|\\`*_{}()#+\-!>[\]]/g, '\\$&');
}

function formatLocalTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const tzOffsetMin = -d.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? '+' : '-';
  const absOffset = Math.abs(tzOffsetMin);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMinutes = pad(absOffset % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}${sign}${offsetHours}${offsetMinutes}`;
}
