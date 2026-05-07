/**
 * Clipboard Export Strategy
 * Extracts ChatGPT's `.markdown` content from the DOM and converts to Markdown
 * via TurndownService. This is equivalent to what ChatGPT's native copy button
 * produces, but avoids the unreliability of programmatic clipboard access from
 * extension content scripts.
 */

import { ExportChatData, ExportConfig } from './config';
import { ExportResult } from './engine';
import { TurndownService } from './turndown';
import { formatFileName } from './filename';
import { BACK_TO_TOP_LINK, truncate, escapeMd, formatLocalTime } from './utils';

/** ChatGPT conversation turn container — try the live selector first */
const TURN_SELECTOR = 'section[data-testid^="conversation-turn-"], article[data-testid^="conversation-turn-"]';
/** Content container within a turn */
const CONTENT_SELECTOR = '.markdown, .whitespace-pre-wrap';

/**
 * Extract HTML content from a ChatGPT conversation turn element.
 * Returns innerHTML of the `.markdown` container, or null if not found.
 */
function extractTurnContent(turn: HTMLElement): string | null {
  const container = turn.querySelector<HTMLElement>(CONTENT_SELECTOR);
  return container ? container.innerHTML : null;
}

/**
 * Export chat via DOM content extraction + TurndownService conversion.
 * This produces the same Markdown that ChatGPT's native copy button provides,
 * without the fragility of programmatic clipboard access.
 */
export async function exportViaClipboard(
  chatData: ExportChatData,
  config: ExportConfig,
  turndown: TurndownService,
): Promise<ExportResult> {
  const turns = document.querySelectorAll<HTMLElement>(TURN_SELECTOR);
  if (turns.length === 0) {
    throw new Error('No conversation turns found on page. The page may not have finished loading.');
  }

  const turnList = Array.from(turns);
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
      const matchingTurn = turnList[aiIndex];
      aiIndex++;

      let markdownContent = '';
      if (matchingTurn) {
        const html = extractTurnContent(matchingTurn);
        if (html) {
          try {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = html;
            markdownContent = turndown.turndown(wrapper);
          } catch {
            markdownContent = msg.contentText;
          }
        }
      }

      if (markdownContent) {
        content += markdownContent + '\n\n' + BACK_TO_TOP_LINK;
      } else {
        content += `## chat-${exportChatIndex}\n\n_[Content unavailable]_\n\n${BACK_TO_TOP_LINK}`;
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
