/**
 * Export Dialog
 * Preview outline with checkboxes for selective export
 */

import { PlatformAdapter, ExportSettings, DEFAULT_EXPORT_SETTINGS, ConversationMessage } from '@shared/types';
import { ErrorHandler } from '@shared/errors';
import { Toast } from '@shared/toast';
import { ExportChatData, ExportedMessage } from '../export/config';
import { TurndownService } from '../export/turndown';
import { generateMarkdown, generateJSON, downloadFile } from '../export/engine';

export class ExportDialog {
  private dialog: HTMLElement | null = null;
  private adapter: PlatformAdapter;
  private chatData: ExportChatData | null = null;
  private selectedMessageIds: Set<string> = new Set();
  private turndownService: TurndownService;

  constructor(adapter: PlatformAdapter) {
    this.adapter = adapter;
    this.turndownService = new TurndownService();
    this.setupPlatformRules();
  }

  private setupPlatformRules(): void {
    if (this.adapter.name === 'ChatGPT') {
      // ChatGPT-specific: pre/code blocks with CodeMirror 6 and language header
      // Use unshiftRule to insert BEFORE the default 'codeblock' rule
      // TODO: 后续优化语言检测，目前强制使用空字符串避免误匹配
      this.turndownService.unshiftRule('chatgptCodeBlock', {
        filter: (node: Element) => node.nodeName === 'PRE',
        replacement: (_content, node) => {
          // Extract code content — ChatGPT uses CodeMirror 6 (.cm-content)
          const cmContent = node.querySelector('.cm-content');
          let codeText: string;
          if (cmContent) {
            codeText = (cmContent as HTMLElement).innerText;
          } else {
            const codeEl = node.querySelector('code');
            codeText = codeEl ? codeEl.textContent ?? '' : node.textContent ?? '';
          }

          const cleanCode = codeText.trim();

          return `\n\n\`\`\`\n${cleanCode}\n\`\`\`\n\n`;
        },
      });

      // Remove reaction buttons (data-testid="copy-turn-action-button")
      this.turndownService.addRule('chatgptRemoveReactions', {
        filter: (node: Element) =>
          node.nodeName === 'DIV' &&
          !!node.querySelector('button[data-testid="copy-turn-action-button"]'),
        replacement: () => '',
      });
      // Remove hidden h6 "ChatGPT said:"
      this.turndownService.addRule('chatgptRemoveH6', {
        filter: (node: Element) =>
          node.nodeName === 'H6' &&
          node.classList.contains('sr-only') &&
          (node.textContent?.trim().toLowerCase().startsWith('chatgpt said') ?? false),
        replacement: () => '',
      });
    }
  }

  /**
   * Build ExportChatData from adapter's conversation history
   */
  private buildChatData(messages: ConversationMessage[], exportMethod: string): ExportChatData {
    const exportedMessages: ExportedMessage[] = messages.map((msg, index) => ({
      id: `${msg.role}-${index + 1}-${Date.now()}`,
      role: msg.role,
      contentText: msg.content,
      contentHtml: null,
      originalIndex: index,
    }));

    // Only populate HTML for DOM mode (needed for Turndown conversion)
    if (exportMethod === 'dom') {
      this.populateContentHtml(exportedMessages);
    }

    return {
      title: this.adapter.getChatTitle(),
      platform: this.adapter.name,
      threadUrl: window.location.href,
      messages: exportedMessages,
      messageCount: exportedMessages.filter((m) => m.role === 'user').length,
      exportedAt: new Date(),
    };
  }

  /**
   * Try to associate DOM elements with exported messages for HTML→Markdown conversion
   */
  private populateContentHtml(messages: ExportedMessage[]): void {
    if (this.adapter.name === 'ChatGPT') {
      // Current ChatGPT DOM: section[data-testid="conversation-turn-X"]
      const sections = document.querySelectorAll<HTMLElement>(
        'section[data-testid^="conversation-turn-"]',
      );

      if (sections.length > 0) {
        sections.forEach((section) => {
          const turnType = section.getAttribute('data-turn');
          const header = section.querySelector('h4')?.textContent?.trim().toLowerCase() || '';
          const isUser = turnType === 'user' || header.includes('you said');
          const role = isUser ? 'user' : 'assistant';

          const textContainer = section.querySelector<HTMLElement>(
            '.markdown, .whitespace-pre-wrap',
          );

          if (textContainer) {
            // Find the first unmatched message of this role
            const msgIndex = messages.findIndex(
              (m) => m.role === role && m.contentHtml === null,
            );
            if (msgIndex >= 0) {
              messages[msgIndex].contentHtml = textContainer;
            }
          }
        });
        return;
      }

      // Fallback: older DOM with article[data-message-author-role]
      const articles = document.querySelectorAll<HTMLElement>(
        'article[data-message-author-role="user"], article[data-message-author-role="assistant"]',
      );
      articles.forEach((article) => {
        const role = article.getAttribute('data-message-author-role');
        if (role !== 'user' && role !== 'assistant') { return; }

        const textContainer = article.querySelector<HTMLElement>(
          '.markdown, .whitespace-pre-wrap',
        );

        const target = textContainer || article;
        const msgIndex = messages.findIndex(
          (m) => m.role === role && m.contentHtml === null,
        );
        if (msgIndex >= 0) {
          messages[msgIndex].contentHtml = target;
        }
      });
    }
  }

  /**
   * Open the export dialog
   */
  async open(): Promise<void> {
    // Extract messages
    const messages = this.adapter.getConversationHistory();
    if (!messages || messages.length === 0) {
      Toast.warning('未检测到对话内容，请先进行对话');
      return;
    }

    const config = await this.loadExportConfig();
    this.chatData = this.buildChatData(messages, config.exportMethod);

    // Initialize selected IDs (all user messages)
    this.selectedMessageIds.clear();
    this.chatData.messages.forEach((msg) => {
      if (msg.role === 'user') {
        this.selectedMessageIds.add(msg.id);
      }
      // Also add AI responses following selected user messages
      if (msg.role === 'assistant') {
        const prevUser = this.chatData!.messages
          .slice(0, this.chatData!.messages.indexOf(msg))
          .reverse()
          .find((m) => m.role === 'user');
        if (prevUser && this.selectedMessageIds.has(prevUser.id)) {
          this.selectedMessageIds.add(msg.id);
        }
      }
    });

    // Render dialog
    this.render();
  }

  /**
   * Close the dialog
   */
  close(): void {
    if (this.dialog) {
      this.dialog.remove();
      this.dialog = null;
    }
    document.body.classList.remove('chat-copilot-modal-open');
  }

  /**
   * Render the export dialog
   */
  private render(): void {
    // Remove existing dialog
    document.querySelector('.chat-copilot-export-dialog')?.remove();
    this.dialog = null;

    if (!this.chatData) {
      return;
    }

    const dialog = document.createElement('div');
    dialog.className = 'chat-copilot-export-dialog';
    this.dialog = dialog;

    // Header
    const header = document.createElement('div');
    header.className = 'chat-copilot-dialog-header';
    header.innerHTML = `
      <div class="chat-copilot-header-left">
        <span class="chat-copilot-export-title">导出对话</span>
        <span class="chat-copilot-export-chat-title">${this.escapeHtml(this.chatData.title)}</span>
      </div>
      <button class="chat-copilot-close">&times;</button>
    `;
    dialog.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'chat-copilot-dialog-body';

    // Select all
    const selectAllRow = document.createElement('div');
    selectAllRow.className = 'chat-copilot-export-select-all';
    const selectAllCheckbox = document.createElement('input');
    selectAllCheckbox.type = 'checkbox';
    selectAllCheckbox.checked = true;
    selectAllCheckbox.className = 'chat-copilot-export-checkbox';
    const selectAllLabel = document.createElement('span');
    selectAllLabel.textContent = '全选';
    selectAllRow.appendChild(selectAllCheckbox);
    selectAllRow.appendChild(selectAllLabel);
    body.appendChild(selectAllRow);

    // Search input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'chat-copilot-export-search';
    searchInput.placeholder = '搜索对话内容...';
    body.appendChild(searchInput);

    // Separator
    const sep = document.createElement('hr');
    sep.className = 'chat-copilot-export-separator';
    body.appendChild(sep);

    // Message list
    const messageList = document.createElement('div');
    messageList.className = 'chat-copilot-export-message-list';

    let userCount = 0;
    const itemElements: Map<string, HTMLElement> = new Map();

    this.chatData.messages.forEach((msg) => {
      if (msg.role !== 'user') {
        return;
      }
      userCount++;

      const item = document.createElement('div');
      item.className = 'chat-copilot-export-item';
      item.dataset.messageId = msg.id;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'chat-copilot-export-checkbox';
      cb.checked = this.selectedMessageIds.has(msg.id);
      cb.dataset.messageId = msg.id;

      const preview = document.createElement('span');
      preview.className = 'chat-copilot-export-item-text';
      preview.textContent = `${userCount}: ${this.truncate(msg.contentText, 50)}`;
      preview.title = msg.contentText;

      item.appendChild(cb);
      item.appendChild(preview);
      messageList.appendChild(item);
      itemElements.set(msg.id, item);
    });

    body.appendChild(messageList);

    // Message count
    const countDisplay = document.createElement('div');
    countDisplay.className = 'chat-copilot-export-count';
    countDisplay.id = 'chat-copilot-export-count';
    countDisplay.textContent = `将导出 ${userCount} 条对话`;
    body.appendChild(countDisplay);

    dialog.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'chat-copilot-dialog-footer';

    const exportMdBtn = document.createElement('button');
    exportMdBtn.className = 'chat-copilot-btn chat-copilot-btn-primary';
    exportMdBtn.textContent = '导出 Markdown';
    footer.appendChild(exportMdBtn);

    const exportJsonBtn = document.createElement('button');
    exportJsonBtn.className = 'chat-copilot-btn';
    exportJsonBtn.textContent = '导出 JSON';
    footer.appendChild(exportJsonBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'chat-copilot-btn chat-copilot-btn-cancel';
    cancelBtn.textContent = '取消';
    footer.appendChild(cancelBtn);

    dialog.appendChild(footer);

    // Events
    const updateCount = () => {
      const selectedCount = messageList.querySelectorAll<HTMLInputElement>(
        '.chat-copilot-export-checkbox:checked',
      ).length;
      const countEl = dialog.querySelector('#chat-copilot-export-count');
      if (countEl) {
        countEl.textContent = `将导出 ${selectedCount} 条对话`;
      }
      // Update select all
      const totalVisible = messageList.querySelectorAll<HTMLInputElement>(
        '.chat-copilot-export-checkbox',
      ).length;
      const checkedVisible = messageList.querySelectorAll<HTMLInputElement>(
        '.chat-copilot-export-checkbox:checked',
      ).length;
      selectAllCheckbox.checked = totalVisible > 0 && totalVisible === checkedVisible;
    };

    // Select all
    selectAllCheckbox.addEventListener('change', () => {
      const checked = selectAllCheckbox.checked;
      messageList.querySelectorAll<HTMLInputElement>('.chat-copilot-export-checkbox').forEach((c) => {
        c.checked = checked;
      });
      updateCount();
    });

    // Individual checkbox
    messageList.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.classList.contains('chat-copilot-export-checkbox')) {
        updateCount();
      }
    });

    // Search
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      messageList.querySelectorAll<HTMLElement>('.chat-copilot-export-item').forEach((item) => {
        const text = item.querySelector('.chat-copilot-export-item-text')?.textContent?.toLowerCase() ?? '';
        item.style.display = !query || text.includes(query) ? '' : 'none';
      });
      updateCount();
    });

    // Close
    const closeDialog = () => this.close();
    dialog.querySelector('.chat-copilot-close')?.addEventListener('click', closeDialog);
    cancelBtn.addEventListener('click', closeDialog);

    // Export Markdown
    exportMdBtn.addEventListener('click', () => {
      this.handleExport('markdown');
    });

    // Export JSON
    exportJsonBtn.addEventListener('click', () => {
      this.handleExport('json');
    });

    document.body.appendChild(dialog);
    document.body.classList.add('chat-copilot-modal-open');
  }

  /**
   * Handle export
   */
  private async handleExport(format: 'markdown' | 'json'): Promise<void> {
    if (!this.chatData || !this.dialog) {
      return;
    }

    // Gather selected message IDs from checkboxes
    const selectedIds = new Set<string>();
    const messageList = this.dialog.querySelector('.chat-copilot-export-message-list');
    if (messageList) {
      messageList.querySelectorAll<HTMLInputElement>('.chat-copilot-export-checkbox:checked').forEach((cb) => {
        const id = cb.dataset.messageId;
        if (id) {
          selectedIds.add(id);
          // Also select the AI response following this user message
          const msgIndex = this.chatData!.messages.findIndex((m) => m.id === id);
          if (msgIndex >= 0) {
            const nextMsg = this.chatData!.messages[msgIndex + 1];
            if (nextMsg && nextMsg.role === 'assistant') {
              selectedIds.add(nextMsg.id);
            }
          }
        }
      });
    }

    if (selectedIds.size === 0) {
      Toast.warning('请至少选择一条对话');
      return;
    }

    // Filter messages
    const filteredData: ExportChatData = {
      ...this.chatData,
      messages: this.chatData.messages.filter((m) => selectedIds.has(m.id)),
      messageCount: this.chatData.messages.filter((m) => m.role === 'user' && selectedIds.has(m.id)).length,
      exportedAt: new Date(),
    };

    // Load config
    try {
      const config = await this.loadExportConfig();
      let result;
      if (format === 'markdown') {
        result = await generateMarkdown(filteredData, config, this.turndownService);
        downloadFile(result.fileName, result.output, 'text/markdown;charset=utf-8');
      } else {
        result = generateJSON(filteredData, config, this.turndownService);
        downloadFile(result.fileName, result.output, 'application/json;charset=utf-8');
      }
      Toast.success(`已导出 ${result.fileName}`);
      this.close();
    } catch (error) {
      ErrorHandler.logError(error, 'handleExport');
      Toast.error('导出失败: ' + ErrorHandler.getErrorMessage(error));
    }
  }

  /**
   * Load export configuration from storage
   */
  private async loadExportConfig(): Promise<ExportSettings> {
    try {
      const result = await chrome.storage.local.get(['exportSettings']);
      return result.exportSettings ?? DEFAULT_EXPORT_SETTINGS;
    } catch {
      return DEFAULT_EXPORT_SETTINGS;
    }
  }

  private truncate(str: string, len = 50): string {
    return str.length <= len ? str : str.slice(0, len).trim() + '...';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
