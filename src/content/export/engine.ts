/**
 * Export Engine
 * Generates Markdown / JSON from chat data
 */

import { ExportChatData, ExportConfig } from './config';
import { TurndownService } from './turndown';
import { formatFileName } from './filename';
import { BACK_TO_TOP_LINK, truncate, escapeMd, formatLocalTime } from './utils';

/**
 * Export result containing output string and filename
 */
export interface ExportResult {
  output: string;
  fileName: string;
}

/**
 * Generate Markdown from chat data
 */
export function generateMarkdown(
  chatData: ExportChatData,
  config: ExportConfig,
  turndown: TurndownService,
): ExportResult {
  let toc = '';
  let content = '';
  let exportChatIndex = 0;

  chatData.messages.forEach((msg) => {
    if (msg.role === 'user') {
      exportChatIndex++;
      const preview = truncate(msg.contentText.replace(/\s+/g, ' '), 70);
      toc += `- [${exportChatIndex}: ${escapeMd(preview)}](#chat-${exportChatIndex})\n`;
      content += `## chat-${exportChatIndex}\n\n> ${msg.contentText.replace(/\n/g, '\n> ')}\n\n`;
    } else {
      let markdownContent: string;
      if (msg.contentHtml) {
        try {
          markdownContent = turndown.turndown(msg.contentHtml);
        } catch {
          markdownContent = `[CONVERSION ERROR]\n\n\`\`\`\n${msg.contentText}\n\`\`\`\n`;
        }
      } else {
        markdownContent = msg.contentText;
      }
      content += markdownContent + '\n\n' + BACK_TO_TOP_LINK;
    }
  });

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

/**
 * Generate JSON from chat data
 */
export function generateJSON(
  chatData: ExportChatData,
  config: ExportConfig,
  turndown: TurndownService,
): ExportResult {
  const messages = chatData.messages.map((msg) => ({
    role: msg.role,
    content:
      msg.role === 'user'
        ? msg.contentText
        : msg.contentHtml
          ? turndown.turndown(msg.contentHtml)
          : msg.contentText,
  }));

  const jsonOutput = {
    title: chatData.title,
    author: chatData.platform,
    count: chatData.messageCount,
    date: chatData.exportedAt.toISOString(),
    url: chatData.threadUrl,
    messages,
  };

  const fileName = formatFileName(
    config.filenameTemplate,
    chatData.title,
    chatData.platform,
    [],
    'json',
  );

  return {
    output: JSON.stringify(jsonOutput, null, 2),
    fileName,
  };
}

/**
 * Download text as a file
 */
export function downloadFile(filename: string, text: string, mimeType = 'text/markdown;charset=utf-8'): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}


