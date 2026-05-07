/**
 * Knowledge Dialog
 * 知识提炼结果预览与编辑弹窗
 */

import {
  KnowledgeResult,
  ConversationMessage,
  MessageType,
  FeishuConfig,
  SaveToFeishuResponse,
  MessageResponse,
} from '@shared/types';
import { Toast } from '@shared/toast';
import { ErrorHandler } from '@shared/errors';

export class KnowledgeDialog {
  private dialog: HTMLElement | null = null;
  private knowledge: KnowledgeResult | null = null;
  private originalConversation: ConversationMessage[] = [];
  private feishuConfig: FeishuConfig | null = null;
  private isLoading = false;

  /**
   * 显示知识提炼结果弹窗
   */
  async show(
    originalConversation: ConversationMessage[],
    knowledge: KnowledgeResult,
  ): Promise<void> {
    this.originalConversation = originalConversation;
    this.knowledge = knowledge;

    // 加载飞书配置
    await this.loadFeishuConfig();

    // 移除已有弹窗
    this.removeExisting();

    const dialog = this.createDialog(knowledge);
    document.body.appendChild(dialog);
    document.body.classList.add('chat-copilot-modal-open');
    this.dialog = dialog;
    this.bindEvents(dialog);
  }

  /**
   * 显示加载状态
   */
  showLoading(message = '正在提炼对话中的知识...'): HTMLElement {
    this.removeExisting();

    const dialog = document.createElement('div');
    dialog.className = 'chat-copilot-dialog';
    dialog.innerHTML = `
      <div class="chat-copilot-dialog-content chat-copilot-knowledge-dialog-content">
        <div class="chat-copilot-dialog-header">
          <div class="chat-copilot-header-left">
            <h3 class="chat-copilot-title">🧠 知识提炼</h3>
          </div>
        </div>
        <div class="chat-copilot-dialog-body knowledge-loading">
          <div class="chat-copilot-spinner"></div>
          <p>${this.escapeHtml(message)}</p>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    document.body.classList.add('chat-copilot-modal-open');
    this.dialog = dialog;
    return dialog;
  }

  /**
   * 显示保存成功状态
   */
  showSuccess(documentUrl?: string): void {
    if (!this.dialog) { return; }

    const body = this.dialog.querySelector('.chat-copilot-dialog-body');
    if (!body) { return; }

    body.innerHTML = `
      <div class="chat-copilot-knowledge-success">
        <div class="chat-copilot-knowledge-success-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <div class="chat-copilot-knowledge-success-title">✨ 已保存到飞书知识库</div>
        ${documentUrl ? `
          <a href="${this.escapeHtml(documentUrl)}" target="_blank" class="chat-copilot-knowledge-success-link">
            📄 查看文档
          </a>
        ` : ''}
      </div>
    `;

    // 隐藏操作按钮
    const footer = this.dialog.querySelector('.chat-copilot-dialog-footer');
    if (footer) {
      (footer as HTMLElement).style.display = 'none';
    }
  }

  /**
   * 显示错误状态
   */
  showError(message: string): void {
    if (!this.dialog) { return; }

    const body = this.dialog.querySelector('.chat-copilot-dialog-body');
    if (!body) { return; }
    body.classList.remove('knowledge-loading');

    this.isLoading = false;
    Toast.error(message);
  }

  /**
   * 关闭弹窗
   */
  close(): void {
    this.removeExisting();
  }

  private removeExisting(): void {
    const existing = document.querySelector('.chat-copilot-dialog');
    if (existing) {
      existing.remove();
      document.body.classList.remove('chat-copilot-modal-open');
    }
    this.dialog = null;
  }

  /**
   * 加载飞书配置
   */
  private async loadFeishuConfig(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: MessageType.GET_FEISHU_CONFIG });
      if (response.success && response.data) {
        this.feishuConfig = response.data as FeishuConfig;
      }
    } catch (error) {
      // 静默处理，没有配置也可以正常显示提炼结果
    }
  }

  /**
   * 创建弹窗 DOM
   */
  private createDialog(knowledge: KnowledgeResult): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'chat-copilot-dialog';

    const hasFeishu = !!this.feishuConfig?.appId && !!this.feishuConfig?.spaceId;

    dialog.innerHTML = `
      <div class="chat-copilot-dialog-content chat-copilot-knowledge-dialog-content">
        <div class="chat-copilot-dialog-header" style="padding: 10px 16px;">
          <div class="chat-copilot-header-left">
            <h3 class="chat-copilot-title">🧠 知识提炼结果</h3>
          </div>
          <button class="chat-copilot-close" title="关闭">&times;</button>
        </div>
        <div class="chat-copilot-dialog-body chat-copilot-knowledge-body">
          <!-- 标题 -->
          <div class="chat-copilot-knowledge-section">
            <div class="chat-copilot-knowledge-section-title">📌 标题</div>
            <input class="chat-copilot-knowledge-title-input" type="text" value="${this.escapeHtml(knowledge.title)}" data-field="title" />
          </div>

          <!-- 摘要 -->
          <div class="chat-copilot-knowledge-section">
            <div class="chat-copilot-knowledge-section-title">📝 摘要</div>
            <textarea class="chat-copilot-knowledge-summary-textarea" data-field="summary" rows="2">${this.escapeHtml(knowledge.summary)}</textarea>
          </div>

          <!-- 关键要点 -->
          <div class="chat-copilot-knowledge-section">
            <div class="chat-copilot-knowledge-section-title">🎯 关键要点</div>
            <div class="chat-copilot-knowledge-keypoints" data-field="keyPoints">
              ${knowledge.keyPoints.map((point, i) => this.createKeypointRow(i, point)).join('')}
            </div>
            <button class="chat-copilot-knowledge-add-keypoint" type="button">+ 添加要点</button>
          </div>

          <!-- 详细内容 -->
          <div class="chat-copilot-knowledge-section">
            <div class="chat-copilot-knowledge-section-title">📄 详细内容</div>
            <textarea class="chat-copilot-knowledge-details-textarea" data-field="details" rows="8">${this.escapeHtml(knowledge.details)}</textarea>
          </div>

          <!-- 标签 -->
          <div class="chat-copilot-knowledge-section">
            <div class="chat-copilot-knowledge-section-title">🏷️ 标签</div>
            <div class="chat-copilot-knowledge-tags-container" data-field="tags">
              ${knowledge.tags.map(tag => `
                <span class="chat-copilot-knowledge-tag">
                  ${this.escapeHtml(tag)}
                  <button class="chat-copilot-knowledge-tag-remove" type="button">&times;</button>
                </span>
              `).join('')}
              <input class="chat-copilot-knowledge-tag-input" type="text" placeholder="输入标签后回车" />
            </div>
          </div>

          <!-- 来源 -->
          <div class="chat-copilot-knowledge-section">
            <div class="chat-copilot-knowledge-section-title">🔗 来源</div>
            <div class="chat-copilot-knowledge-source">
              <div class="chat-copilot-knowledge-source-item">平台: ${this.escapeHtml(knowledge.sourcePlatform)}</div>
              <div class="chat-copilot-knowledge-source-item">链接: <a href="${this.escapeHtml(knowledge.sourceUrl)}" target="_blank">${this.escapeHtml(knowledge.sourceUrl)}</a></div>
              <div class="chat-copilot-knowledge-source-item">时间: ${new Date(knowledge.createdAt).toLocaleString('zh-CN')}</div>
            </div>
          </div>
        </div>
        <div class="chat-copilot-dialog-footer" style="padding: 8px 16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-right:auto;">
            <button class="chat-copilot-btn-reoptimize" type="button">🔄 重新提炼</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="chat-copilot-btn-copy" type="button">📋 复制内容</button>
            ${hasFeishu ? `
              <button class="chat-copilot-btn-save-feishu" type="button" style="background:var(--cc-primary);color:var(--cc-text-inverse);border-color:transparent;">
                💾 保存到飞书
              </button>
            ` : `
              <button class="chat-copilot-btn-config-feishu" type="button" style="background:var(--cc-bg-muted);color:var(--cc-text-secondary);">
                ⚙️ 配置飞书
              </button>
            `}
            <button class="chat-copilot-btn-cancel" type="button">关闭</button>
          </div>
        </div>
      </div>
    `;

    return dialog;
  }

  /**
   * 创建关键要点行
   */
  private createKeypointRow(index: number, text: string): string {
    return `
      <div class="chat-copilot-knowledge-keypoint-row" data-index="${index}">
        <span class="chat-copilot-knowledge-keypoint-num">${index + 1}</span>
        <input class="chat-copilot-knowledge-keypoint-input" type="text" value="${this.escapeHtml(text)}" />
        <button class="chat-copilot-knowledge-keypoint-remove" type="button" title="删除">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
  }

  /**
   * 绑定事件
   */
  private bindEvents(dialog: HTMLElement): void {
    // 关闭
    dialog.querySelector('.chat-copilot-close')?.addEventListener('click', () => this.close());
    dialog.querySelector('.chat-copilot-btn-cancel')?.addEventListener('click', () => this.close());

    // 点击遮罩关闭
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) { this.close(); }
    });

    // 重新提炼
    dialog.querySelector('.chat-copilot-btn-reoptimize')?.addEventListener('click', () => {
      this.close();
      // 触发重新提炼（由外部处理）
      document.dispatchEvent(new CustomEvent('chat-copilot:re-extract'));
    });

    // 复制内容
    dialog.querySelector('.chat-copilot-btn-copy')?.addEventListener('click', () => {
      this.copyContent();
    });

    // 保存到飞书
    dialog.querySelector('.chat-copilot-btn-save-feishu')?.addEventListener('click', () => {
      this.saveToFeishu();
    });

    // 配置飞书
    dialog.querySelector('.chat-copilot-btn-config-feishu')?.addEventListener('click', () => {
      this.openFeishuConfig();
    });

    // 添加关键要点
    dialog.querySelector('.chat-copilot-knowledge-add-keypoint')?.addEventListener('click', () => {
      this.addKeypoint(dialog);
    });

    // 删除关键要点（委托）
    dialog.querySelector('.chat-copilot-knowledge-keypoints')?.addEventListener('click', (e) => {
      const removeBtn = (e.target as HTMLElement).closest('.chat-copilot-knowledge-keypoint-remove');
      if (removeBtn) {
        const row = removeBtn.closest('.chat-copilot-knowledge-keypoint-row') as HTMLElement;
        if (row) { row.remove(); this.reindexKeypoints(dialog); }
      }
    });

    // 标签输入
    const tagInput = dialog.querySelector('.chat-copilot-knowledge-tag-input') as HTMLInputElement;
    tagInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = tagInput.value.trim();
        if (value) {
          this.addTag(dialog, value);
          tagInput.value = '';
        }
      }
    });

    // 删除标签（委托）
    dialog.querySelector('.chat-copilot-knowledge-tags-container')?.addEventListener('click', (e) => {
      const removeBtn = (e.target as HTMLElement).closest('.chat-copilot-knowledge-tag-remove');
      if (removeBtn) {
        const tag = removeBtn.closest('.chat-copilot-knowledge-tag') as HTMLElement;
        if (tag) { tag.remove(); }
      }
    });
  }

  /**
   * 从弹窗中收集当前知识数据
   */
  private collectKnowledge(): KnowledgeResult {
    if (!this.dialog || !this.knowledge) {
      return {
        title: '',
        summary: '',
        keyPoints: [],
        details: '',
        tags: [],
        sourceUrl: '',
        sourcePlatform: '',
        createdAt: Date.now(),
      };
    }

    const title = (this.dialog.querySelector('[data-field="title"]') as HTMLInputElement)?.value || '';
    const summary = (this.dialog.querySelector('[data-field="summary"]') as HTMLTextAreaElement)?.value || '';

    const keypointInputs = this.dialog.querySelectorAll('.chat-copilot-knowledge-keypoint-input');
    const keyPoints: string[] = [];
    keypointInputs.forEach(input => {
      const value = (input as HTMLInputElement).value.trim();
      if (value) { keyPoints.push(value); }
    });

    const details = (this.dialog.querySelector('[data-field="details"]') as HTMLTextAreaElement)?.value || '';

    const tagElements = this.dialog.querySelectorAll('.chat-copilot-knowledge-tag');
    const tags: string[] = [];
    tagElements.forEach(el => {
      const text = el.textContent?.replace('×', '').trim();
      if (text) { tags.push(text); }
    });

    return {
      ...this.knowledge,
      title,
      summary,
      keyPoints,
      details,
      tags,
    };
  }

  /**
   * 复制提炼内容到剪贴板
   */
  private async copyContent(): Promise<void> {
    const knowledge = this.collectKnowledge();
    const text = [
      `# ${knowledge.title}`,
      '',
      `> ${knowledge.summary}`,
      '',
      '## 关键要点',
      ...knowledge.keyPoints.map((p, i) => `${i + 1}. ${p}`),
      '',
      '## 详细内容',
      knowledge.details,
      '',
      '---',
      `来源: ${knowledge.sourcePlatform} | ${knowledge.sourceUrl}`,
      `提炼时间: ${new Date(knowledge.createdAt).toLocaleString('zh-CN')}`,
      knowledge.tags.length > 0 ? `标签: ${knowledge.tags.join('、')}` : '',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      Toast.success('已复制到剪贴板');
    } catch {
      Toast.error('复制失败');
    }
  }

  /**
   * 保存到飞书知识库
   */
  private async saveToFeishu(): Promise<void> {
    if (!this.feishuConfig) {
      Toast.warning('请先配置飞书应用');
      return;
    }

    if (!this.feishuConfig.spaceId) {
      Toast.warning('请先选择目标知识空间');
      this.openFeishuConfig();
      return;
    }

    if (this.isLoading) { return; }
    this.isLoading = true;

    const knowledge = this.collectKnowledge();

    // 显示保存中状态
    const footer = this.dialog?.querySelector('.chat-copilot-dialog-footer');
    if (footer) {
      const saveBtn = footer.querySelector('.chat-copilot-btn-save-feishu') as HTMLButtonElement;
      if (saveBtn) {
        saveBtn.textContent = '保存中...';
        saveBtn.disabled = true;
      }
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.SAVE_TO_FEISHU,
        payload: {
          knowledge,
          config: this.feishuConfig,
        },
      }) as MessageResponse<SaveToFeishuResponse>;

      if (response.success && response.data) {
        this.showSuccess(response.data.documentUrl);
        Toast.success('已保存到飞书知识库');
      } else {
        Toast.error(response.error || '保存失败');
      }
    } catch (error) {
      ErrorHandler.logError(error, 'saveToFeishu');
      Toast.error('保存到飞书失败');
    } finally {
      this.isLoading = false;
      if (footer) {
        const saveBtn = footer.querySelector('.chat-copilot-btn-save-feishu') as HTMLButtonElement;
        if (saveBtn) {
          saveBtn.textContent = '💾 保存到飞书';
          saveBtn.disabled = false;
        }
      }
    }
  }

  /**
   * 打开飞书配置页面
   */
  private openFeishuConfig(): void {
    chrome.runtime.sendMessage({ type: MessageType.OPEN_OPTIONS });
  }

  /**
   * 添加关键要点
   */
  private addKeypoint(dialog: HTMLElement): void {
    const container = dialog.querySelector('.chat-copilot-knowledge-keypoints');
    if (!container) { return; }

    const index = container.children.length;
    const temp = document.createElement('div');
    temp.innerHTML = this.createKeypointRow(index, '');
    container.appendChild(temp.firstElementChild!);

    // 聚焦新输入框
    const inputs = container.querySelectorAll('.chat-copilot-knowledge-keypoint-input');
    const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
    lastInput?.focus();
  }

  /**
   * 重新编号关键要点
   */
  private reindexKeypoints(dialog: HTMLElement): void {
    const rows = dialog.querySelectorAll('.chat-copilot-knowledge-keypoint-row');
    rows.forEach((row, i) => {
      const num = row.querySelector('.chat-copilot-knowledge-keypoint-num');
      if (num) { num.textContent = `${i + 1}`; }
    });
  }

  /**
   * 添加标签
   */
  private addTag(dialog: HTMLElement, value: string): void {
    const container = dialog.querySelector('.chat-copilot-knowledge-tags-container');
    if (!container) { return; }

    // 检查是否已存在
    const existing = container.querySelectorAll('.chat-copilot-knowledge-tag');
    for (const el of existing) {
      if (el.textContent?.replace('×', '').trim() === value) { return; }
    }

    const tag = document.createElement('span');
    tag.className = 'chat-copilot-knowledge-tag';
    tag.innerHTML = `
      ${this.escapeHtml(value)}
      <button class="chat-copilot-knowledge-tag-remove" type="button">&times;</button>
    `;
    container.insertBefore(tag, container.lastElementChild);
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
