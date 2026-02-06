/**
 * Prompt Sidebar
 * 提示词广场侧边栏组件
 */

import { PlatformAdapter, PromptItem, PromptCategory, PROMPT_CATEGORIES } from '@shared/types';
import { loadBuiltinPrompts } from '@shared/prompts';
import { Toast } from '@shared/toast';

// 内容截断长度
const CONTENT_TRUNCATE_LENGTH = 100;
const ANSWER_TRUNCATE_LENGTH = 150;


const PUSH_TARGETS_MAP: Record<string, string> = {
  'chatgpt.com': '.w-screen',//
  'chat.openai.com': '.w-screen',//
  'claude.ai': 'html',//
  'chat.deepseek.com': '#root > div > div',//
  'gemini.google.com': '#app-root',//
  'grok.com': 'html',//
  'kimi.com': 'html',//
  'kimi.moonshot.cn': 'html',//
  'perplexity.ai': 'html',
  'www.perplexity.ai': 'html',
  'www.qianwen.com': 'html',//
  'chat.qwen.ai': 'html',//
  'yiyan.baidu.com': 'html',//
  'yuanbao.tencent.com': 'html',//
};


export class PromptSidebar {
  private adapter: PlatformAdapter;
  private sidebar: HTMLElement | null = null;
  private pushTarget: HTMLElement | null = null;
  private pushModeEnabled = true;
  private pushTargetCleanupTimer: number | null = null;
  private pushTargetTransitionHandler?: (event: TransitionEvent) => void;
  private pushTargetRafId: number | null = null;
  private toggleButton: HTMLElement | null = null;
  private isOpen = false;
  private activeTab: 'square' | 'favorites' = 'square';
  private selectedCategory: PromptCategory | null = null;
  private searchKeyword = '';
  private prompts: PromptItem[] = [];
  private favoriteIds: Set<string> = new Set();
  private favoritePrompts: Map<string, PromptItem> = new Map();
  private showToggleButton = true;
  private expandedPrompts: Set<string> = new Set(); // 展开的提示词ID
  private expandedAnswers: Set<string> = new Set(); // 展开的答案ID
  private isLoading = true;
  private supportsInsert = true;

  private readonly pushTargetClass = 'chat-copilot-push-target';
  private readonly pushTargetDraggingClass = 'chat-copilot-push-target--dragging';

  constructor(adapter: PlatformAdapter) {
    this.adapter = adapter;
    this.supportsInsert = adapter.name !== 'Generic';
    this.loadPrompts();
    this.loadSettings();
    this.setupStorageListener();
  }

  private getVisibleCategories(): typeof PROMPT_CATEGORIES {
    return PROMPT_CATEGORIES
      .filter(cat => cat.enabled !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  /**
   * 加载提示词数据
   */
  private async loadPrompts(): Promise<void> {
    this.isLoading = true;

    try {
      // 从 JSON 文件加载内置提示词
      const builtinPrompts = await loadBuiltinPrompts();
      this.prompts = [...builtinPrompts];

      // 从存储加载用户自定义提示词和收藏
      const result = await chrome.storage.local.get(['customPrompts', 'favoritePromptIds', 'favoritePrompts']);
      if (result.customPrompts) {
        this.prompts = [...this.prompts, ...result.customPrompts];
      }
      if (result.favoritePromptIds) {
        this.favoriteIds = new Set(result.favoritePromptIds);
      }
      if (result.favoritePrompts) {
        this.favoritePrompts = new Map(
          (result.favoritePrompts as PromptItem[]).map(prompt => [prompt.id, prompt]),
        );
      }
    } catch (error) {
      console.error('Failed to load prompts:', error);
    } finally {
      this.isLoading = false;
      // 如果侧边栏已创建，更新列表
      if (this.sidebar) {
        this.updatePromptList();
      }
    }
  }

  /**
   * 加载设置
   */
  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['settings']);
      this.showToggleButton = this.resolveToggleVisibility(result.settings);
      this.pushModeEnabled = result.settings?.promptSidebarPushMode ?? true;
      this.updateToggleButtonVisibility();
      if (!this.pushModeEnabled && this.isOpen) {
        this.resetPanelOffset(true);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * 设置存储监听器
   */
  private setupStorageListener(): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.settings) {
        const newSettings = changes.settings.newValue;
        this.showToggleButton = this.resolveToggleVisibility(newSettings);
        this.pushModeEnabled = newSettings?.promptSidebarPushMode ?? true;
        this.updateToggleButtonVisibility();
        if (!this.pushModeEnabled && this.isOpen) {
          this.resetPanelOffset(true);
        }
        if (this.pushModeEnabled && this.isOpen) {
          this.applyPanelOffset(this.sidebar?.offsetWidth ?? 0);
        }
      }
    });
  }

  // eslint-disable-next-line max-len
  private resolveToggleVisibility(settings?: { showFloatingButton?: boolean; showPromptSidebarToggle?: boolean }): boolean {
    const showFloatingButton = settings?.showFloatingButton ?? true;
    if (showFloatingButton) {
      return false;
    }
    if (typeof settings?.showPromptSidebarToggle === 'boolean') {
      return settings.showPromptSidebarToggle;
    }
    return true;
  }

  /**
   * 更新悬浮按钮可见性
   */
  private updateToggleButtonVisibility(): void {
    if (this.toggleButton) {
      this.toggleButton.style.display = this.showToggleButton ? 'flex' : 'none';
    }
  }

  /**
   * 初始化侧边栏
   */
  init(): void {
    this.createToggleButton();
    this.createSidebar();
  }

  /**
   * 创建切换按钮
   */
  private createToggleButton(): void {
    // 检查是否已存在
    if (document.querySelector('.chat-copilot-prompt-toggle')) {
      return;
    }

    const button = document.createElement('button');
    button.className = 'chat-copilot-prompt-toggle';
    button.title = '提示词广场';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
      </svg>
      <span class="chat-copilot-prompt-toggle-tooltip">提示词广场</span>
    `;

    button.addEventListener('click', () => this.toggle());

    document.body.appendChild(button);
    this.toggleButton = button;

    // 应用可见性设置
    this.updateToggleButtonVisibility();
  }

  /**
   * 创建侧边栏
   */
  private createSidebar(): void {
    // 检查是否已存在
    if (document.querySelector('.chat-copilot-prompt-sidebar')) {
      return;
    }

    const sidebar = document.createElement('div');
    sidebar.className = 'chat-copilot-prompt-sidebar';
    sidebar.innerHTML = this.renderSidebarContent();

    // 绑定事件
    this.bindSidebarEvents(sidebar);

    document.body.appendChild(sidebar);
    this.sidebar = sidebar;
  }

  /**
   * 渲染侧边栏内容
   */
  private renderSidebarContent(): string {
    const visibleCategories = this.getVisibleCategories();
    if (this.selectedCategory) {
      const visibleCategoryIds = new Set(visibleCategories.map(cat => cat.id));
      if (!visibleCategoryIds.has(this.selectedCategory)) {
        this.selectedCategory = null;
      }
    }

    return `
      <div class="chat-copilot-prompt-sidebar-header">
        <div class="chat-copilot-prompt-sidebar-tabs">
          <button class="chat-copilot-prompt-tab ${this.activeTab === 'square' ? 'active' : ''}" data-tab="square">提示词广场</button>
          <button class="chat-copilot-prompt-tab ${this.activeTab === 'favorites' ? 'active' : ''}" data-tab="favorites">我的收藏</button>
        </div>
        <button class="chat-copilot-prompt-sidebar-close" title="关闭">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="chat-copilot-prompt-sidebar-search">
        <input type="text" placeholder="搜索提示词..." value="${this.escapeHtml(this.searchKeyword)}" />
      </div>

      <div class="chat-copilot-prompt-sidebar-categories">
        ${visibleCategories.map(cat => `
          <button class="chat-copilot-prompt-category ${this.selectedCategory === cat.id ? 'active' : ''}" data-category="${cat.id}">
            ${cat.name}
          </button>
        `).join('')}
      </div>

      <div class="chat-copilot-prompt-sidebar-list">
        ${this.renderPromptList()}
      </div>

      <div class="chat-copilot-prompt-sidebar-resize"></div>
    `;
  }

  /**
   * 渲染提示词列表
   */
  private renderPromptList(): string {
    if (this.isLoading) {
      return `
        <div class="chat-copilot-prompt-loading">
          <div class="chat-copilot-prompt-loading-spinner"></div>
          <p>加载中...</p>
        </div>
      `;
    }

    const filteredPrompts = this.getFilteredPrompts();

    if (filteredPrompts.length === 0) {
      if (this.activeTab === 'favorites') {
        return `
          <div class="chat-copilot-prompt-empty">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1">
              <path d="M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.54 0 3.04.99 3.57 2.36h1.87C12.46 4.99 13.96 4 15.5 4 18 4 20 6 20 8.5c0 3.78-3.4 6.86-8.55 11.18L12 21z"/>
            </svg>
            <p>暂无收藏</p>
          </div>
        `;
      }
      return `
        <div class="chat-copilot-prompt-empty">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p>暂无匹配的提示词</p>
        </div>
      `;
    }

    return filteredPrompts.map(prompt => this.renderPromptCard(prompt)).join('');
  }

  /**
   * 渲染提示词卡片
   */
  private renderPromptCard(prompt: PromptItem): string {
    const isFavorite = this.favoriteIds.has(prompt.id);
    const category = PROMPT_CATEGORIES.find(c => c.id === prompt.category);
    const isContentExpanded = this.expandedPrompts.has(prompt.id);
    const isAnswerExpanded = this.expandedAnswers.has(prompt.id);

    // 处理内容显示
    const needsContentExpand = prompt.content.length > CONTENT_TRUNCATE_LENGTH;
    const displayContent = isContentExpanded || !needsContentExpand
      ? prompt.content
      : prompt.content.substring(0, CONTENT_TRUNCATE_LENGTH) + '...';

    // 处理答案显示
    const hasAnswer = !!prompt.answer;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const needsAnswerExpand = hasAnswer && prompt.answer?.length > ANSWER_TRUNCATE_LENGTH;
    const displayAnswer = hasAnswer
      ? (isAnswerExpanded || !needsAnswerExpand
        ? prompt.answer
        : prompt.answer?.substring(0, ANSWER_TRUNCATE_LENGTH) + '...')
      : '';

    return `
      <div class="chat-copilot-prompt-card ${hasAnswer ? 'has-answer' : ''}" data-prompt-id="${prompt.id}">
        <div class="chat-copilot-prompt-card-header">
          <h4 class="chat-copilot-prompt-card-title">
            ${this.escapeHtml(prompt.title)}
            ${category ? `<span class="chat-copilot-prompt-card-category">${this.escapeHtml(category.name)}</span>` : ''}
          </h4>
          <button class="chat-copilot-prompt-card-favorite ${isFavorite ? 'active' : ''}" data-prompt-id="${prompt.id}" title="${isFavorite ? '取消收藏' : '收藏'}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
            </svg>
          </button>
        </div>

        <div class="chat-copilot-prompt-card-content-wrapper">
          <p class="chat-copilot-prompt-card-content ${isContentExpanded ? 'expanded' : ''}">${this.escapeHtml(displayContent)}</p>
          ${needsContentExpand ? `
            <button class="chat-copilot-prompt-expand-btn" data-prompt-id="${prompt.id}" data-type="content">
              ${isContentExpanded ? '收起' : '展开全部'}
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" class="${isContentExpanded ? 'rotated' : ''}">
                <path d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
          ` : ''}
        </div>

        ${hasAnswer ? `
          <div class="chat-copilot-prompt-card-answer-wrapper">
            <div class="chat-copilot-prompt-card-answer-header">
              <span>参考答案</span>
            </div>
            <div class="chat-copilot-prompt-card-answer ${isAnswerExpanded ? 'expanded' : ''}">
              <pre>${this.escapeHtml(displayAnswer ?? '')}</pre>
            </div>
            ${needsAnswerExpand ? `
              <button class="chat-copilot-prompt-expand-btn" data-prompt-id="${prompt.id}" data-type="answer">
                ${isAnswerExpanded ? '收起答案' : '查看完整答案'}
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" class="${isAnswerExpanded ? 'rotated' : ''}">
                  <path d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
            ` : ''}
          </div>
        ` : ''}

        <div class="chat-copilot-prompt-card-tags">
          ${prompt.tags.map(tag => `<span class="chat-copilot-prompt-tag">#${this.escapeHtml(tag)}</span>`).join('')}
        </div>

        <div class="chat-copilot-prompt-card-actions">
          <button class="chat-copilot-prompt-card-copy" data-prompt-id="${prompt.id}" title="复制">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            复制
          </button>
          ${this.supportsInsert ? `
            <button class="chat-copilot-prompt-card-insert" data-prompt-id="${prompt.id}" title="写入输入框">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14m-7-7h14"/>
              </svg>
              写入
            </button>
          ` : ''}
          ${hasAnswer ? `
            <button class="chat-copilot-prompt-card-copy-answer" data-prompt-id="${prompt.id}" title="复制答案">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              复制答案
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * 绑定侧边栏事件
   */
  private bindSidebarEvents(sidebar: HTMLElement): void {
    // 关闭按钮
    sidebar.querySelector('.chat-copilot-prompt-sidebar-close')?.addEventListener('click', () => {
      this.close();
    });

    // 搜索输入
    const searchInput = sidebar.querySelector('.chat-copilot-prompt-sidebar-search input') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.searchKeyword = (e.target as HTMLInputElement).value;
      this.updatePromptList();
    });

    // Tab 切换
    sidebar.querySelectorAll('.chat-copilot-prompt-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).dataset.tab as 'square' | 'favorites';
        if (this.activeTab === tab) { return; }
        this.activeTab = tab;
        this.searchKeyword = '';
        this.selectedCategory = null;
        this.updateTabs();
        this.updatePromptList();
        this.updateCategories();
        const input = sidebar.querySelector('.chat-copilot-prompt-sidebar-search input') as HTMLInputElement | null;
        if (input) {
          input.value = '';
        }
      });
    });

    // 分类切换
    sidebar.querySelectorAll('.chat-copilot-prompt-category').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const category = (e.currentTarget as HTMLElement).dataset.category as PromptCategory;
        this.selectedCategory = this.selectedCategory === category ? null : category;
        this.updateCategories();
        this.updatePromptList();
      });
    });

    // 提示词卡片事件委托
    sidebar.querySelector('.chat-copilot-prompt-sidebar-list')?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest('button');
      if (!button) { return; }

      const promptId = button.dataset.promptId;
      if (!promptId) { return; }

      if (button.classList.contains('chat-copilot-prompt-card-copy')) {
        this.copyPrompt(promptId);
      } else if (button.classList.contains('chat-copilot-prompt-card-insert')) {
        this.insertPrompt(promptId);
      } else if (button.classList.contains('chat-copilot-prompt-card-favorite')) {
        this.toggleFavorite(promptId);
      } else if (button.classList.contains('chat-copilot-prompt-card-copy-answer')) {
        this.copyAnswer(promptId);
      } else if (button.classList.contains('chat-copilot-prompt-expand-btn')) {
        const type = button.dataset.type;
        if (type === 'content') {
          this.toggleContentExpand(promptId);
        } else if (type === 'answer') {
          this.toggleAnswerExpand(promptId);
        }
      }
    });

    // 拖拽调整宽度
    this.initResize(sidebar);
  }

  /**
   * 切换内容展开状态
   */
  private toggleContentExpand(promptId: string): void {
    if (this.expandedPrompts.has(promptId)) {
      this.expandedPrompts.delete(promptId);
    } else {
      this.expandedPrompts.add(promptId);
    }
    this.updatePromptList();
  }

  /**
   * 切换答案展开状态
   */
  private toggleAnswerExpand(promptId: string): void {
    if (this.expandedAnswers.has(promptId)) {
      this.expandedAnswers.delete(promptId);
    } else {
      this.expandedAnswers.add(promptId);
    }
    this.updatePromptList();
  }

  /**
   * 复制答案
   */
  private copyAnswer(promptId: string): void {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt || !prompt.answer) { return; }

    navigator.clipboard.writeText(prompt.answer).then(() => {
      Toast.success('答案已复制到剪贴板');
    }).catch(() => {
      Toast.error('复制失败');
    });
  }

  /**
   * 初始化拖拽调整宽度
   */
  private initResize(sidebar: HTMLElement): void {
    const resizeHandle = sidebar.querySelector('.chat-copilot-prompt-sidebar-resize');
    if (!resizeHandle) { return; }

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizeHandle.addEventListener('mousedown', (e: Event) => {
      isResizing = true;
      startX = (e as MouseEvent).clientX;
      startWidth = sidebar.offsetWidth;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      this.setPushTargetDragging(true);
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isResizing) { return; }
      const diff = startX - e.clientX;
      const newWidth = Math.min(Math.max(startWidth + diff, 280), 600);
      sidebar.style.width = `${newWidth}px`;
      if (this.isOpen) {
        this.applyPanelOffset(newWidth);
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        this.setPushTargetDragging(false);
        // 保存宽度到存储
        chrome.storage.local.set({ promptSidebarWidth: sidebar.offsetWidth });
        if (this.isOpen) {
          this.applyPanelOffset(sidebar.offsetWidth);
        }
      }
    });
  }

  /**
   * 获取过滤后的提示词
   */
  private getFilteredPrompts(): PromptItem[] {
    let filtered = this.prompts;

    // 按分类过滤
    if (this.activeTab === 'favorites') {
      const favoriteList: PromptItem[] = [];
      this.favoriteIds.forEach(id => {
        const prompt = this.prompts.find(p => p.id === id) || this.favoritePrompts.get(id);
        if (prompt) {
          favoriteList.push(prompt);
        }
      });
      filtered = favoriteList;
      if (this.selectedCategory) {
        filtered = filtered.filter(p => p.category === this.selectedCategory);
      }
    } else if (this.selectedCategory) {
      filtered = filtered.filter(p => p.category === this.selectedCategory);
    }

    // 过滤禁用项
    filtered = filtered.filter(p => p.enabled !== false);

    // 按关键词搜索
    if (this.searchKeyword.trim()) {
      const keyword = this.searchKeyword.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(keyword) ||
        p.content.toLowerCase().includes(keyword) ||
        p.tags.some(t => t.toLowerCase().includes(keyword)),
      );
    }

    return filtered.sort((a, b) => {
      const orderDiff = (a.order ?? 0) - (b.order ?? 0);
      if (orderDiff !== 0) {
        return orderDiff;
      }
      return a.title.localeCompare(b.title);
    });
  }

  /**
   * 更新分类按钮状态
   */
  private updateCategories(): void {
    if (!this.sidebar) { return; }
    this.sidebar.querySelectorAll('.chat-copilot-prompt-category').forEach(btn => {
      const category = (btn as HTMLElement).dataset.category as PromptCategory | undefined;
      btn.classList.toggle('active', !!category && this.selectedCategory === category);
    });
  }

  private updateTabs(): void {
    if (!this.sidebar) { return; }
    this.sidebar.querySelectorAll('.chat-copilot-prompt-tab').forEach(btn => {
      const tab = (btn as HTMLElement).dataset.tab as 'square' | 'favorites' | undefined;
      btn.classList.toggle('active', !!tab && this.activeTab === tab);
    });
  }

  /**
   * 更新提示词列表
   */
  private updatePromptList(): void {
    if (!this.sidebar) { return; }
    const listContainer = this.sidebar.querySelector('.chat-copilot-prompt-sidebar-list');
    if (!listContainer) { return; }

    listContainer.innerHTML = this.renderPromptList();
  }

  /**
   * 复制提示词
   */
  private copyPrompt(promptId: string): void {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) { return; }

    navigator.clipboard.writeText(prompt.content).then(() => {
      Toast.success('已复制到剪贴板');
    }).catch(() => {
      Toast.error('复制失败');
    });
  }

  /**
   * 写入提示词到输入框
   */
  private insertPrompt(promptId: string): void {
    if (!this.supportsInsert) {
      Toast.warning('请在支持的页面使用');
      return;
    }
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) { return; }

    this.adapter.setInputValue(prompt.content);
    Toast.success('已写入输入框');

    // 更新使用次数
    this.updateUsageCount(promptId);
  }

  /**
   * 切换收藏状态
   */
  private async toggleFavorite(promptId: string): Promise<void> {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (this.favoriteIds.has(promptId)) {
      this.favoriteIds.delete(promptId);
      this.favoritePrompts.delete(promptId);
    } else {
      this.favoriteIds.add(promptId);
      if (prompt) {
        this.favoritePrompts.set(promptId, { ...prompt });
      }
    }

    // 保存到存储
    try {
      await chrome.storage.local.set({
        favoritePromptIds: Array.from(this.favoriteIds),
        favoritePrompts: Array.from(this.favoritePrompts.values()),
      });
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }

    // 更新UI
    this.updatePromptList();
  }

  /**
   * 更新使用次数
   */
  private async updateUsageCount(promptId: string): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['promptUsageCount']);
      const usageCount = result.promptUsageCount || {};
      usageCount[promptId] = (usageCount[promptId] || 0) + 1;
      await chrome.storage.local.set({ promptUsageCount: usageCount });
    } catch (error) {
      console.error('Failed to update usage count:', error);
    }
  }

  /**
   * 切换侧边栏显示状态
   */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  openTab(tab: 'square' | 'favorites'): void {
    if (!this.sidebar) {
      this.createSidebar();
    }
    this.activeTab = tab;
    this.searchKeyword = '';
    if (this.sidebar) {
      const input = this.sidebar.querySelector('.chat-copilot-prompt-sidebar-search input') as HTMLInputElement | null;
      if (input) {
        input.value = '';
      }
      this.updateTabs();
      this.updateCategories();
      this.updatePromptList();
    }
    if (!this.isOpen) {
      void this.open();
    }
  }

  /**
   * 打开侧边栏
   */
  async open(): Promise<void> {
    if (!this.sidebar) { return; }

    // 恢复保存的宽度
    try {
      const result = await chrome.storage.local.get(['promptSidebarWidth']);
      if (result.promptSidebarWidth) {
        this.sidebar.style.width = `${result.promptSidebarWidth}px`;
      }
    } catch (error) {
      // 忽略错误
    }

    this.sidebar.classList.add('open');
    this.toggleButton?.classList.add('active');
    this.isOpen = true;
    this.applyPanelOffset(this.sidebar.offsetWidth);
  }

  /**
   * 关闭侧边栏
   */
  close(): void {
    if (!this.sidebar) { return; }
    this.sidebar.classList.remove('open');
    this.toggleButton?.classList.remove('active');
    this.isOpen = false;
    this.resetPanelOffset();
  }

  private applyPanelOffset(width: number): void {
    if (!this.pushModeEnabled) { return; }
    const target = this.resolvePushTarget();
    if (!target) { return; }
    const isNewTarget = !this.pushTarget || this.pushTarget !== target;
    if (isNewTarget) {
      this.cleanupPushTarget();
      this.pushTarget = target;
      target.classList.add(this.pushTargetClass);
      target.style.setProperty('--cc-push-offset', '0px');
    }
    this.cancelPushTargetCleanup();
    this.cancelPushTargetRaf();
    if (isNewTarget) {
      this.pushTargetRafId = window.requestAnimationFrame(() => {
        this.pushTargetRafId = null;
        if (this.pushTarget === target) {
          target.style.setProperty('--cc-push-offset', `${width}px`);
        }
      });
      return;
    }
    target.style.setProperty('--cc-push-offset', `${width}px`);
  }

  private resetPanelOffset(immediate = false): void {
    if (!this.pushTarget) { return; }
    const target = this.pushTarget;
    this.cancelPushTargetCleanup();
    this.cancelPushTargetRaf();
    if (immediate) {
      this.cleanupPushTarget();
      return;
    }
    target.style.setProperty('--cc-push-offset', '0px');
    this.pushTargetTransitionHandler = (event: TransitionEvent) => {
      if (event.propertyName !== 'padding-right') { return; }
      this.cleanupPushTarget();
    };
    target.addEventListener('transitionend', this.pushTargetTransitionHandler);
    this.pushTargetCleanupTimer = window.setTimeout(() => {
      this.cleanupPushTarget();
    }, 520);
  }

  private setPushTargetDragging(isDragging: boolean): void {
    if (!this.pushTarget) { return; }
    this.pushTarget.classList.toggle(this.pushTargetDraggingClass, isDragging);
  }

  private cancelPushTargetCleanup(): void {
    if (!this.pushTarget) { return; }
    if (this.pushTargetCleanupTimer !== null) {
      window.clearTimeout(this.pushTargetCleanupTimer);
      this.pushTargetCleanupTimer = null;
    }
    if (this.pushTargetTransitionHandler) {
      this.pushTarget.removeEventListener('transitionend', this.pushTargetTransitionHandler);
      this.pushTargetTransitionHandler = undefined;
    }
  }

  private cancelPushTargetRaf(): void {
    if (this.pushTargetRafId !== null) {
      window.cancelAnimationFrame(this.pushTargetRafId);
      this.pushTargetRafId = null;
    }
  }

  private cleanupPushTarget(): void {
    if (!this.pushTarget) { return; }
    const target = this.pushTarget;
    this.cancelPushTargetRaf();
    if (this.pushTargetCleanupTimer !== null) {
      window.clearTimeout(this.pushTargetCleanupTimer);
      this.pushTargetCleanupTimer = null;
    }
    if (this.pushTargetTransitionHandler) {
      target.removeEventListener('transitionend', this.pushTargetTransitionHandler);
      this.pushTargetTransitionHandler = undefined;
    }
    target.classList.remove(this.pushTargetClass, this.pushTargetDraggingClass);
    target.style.removeProperty('--cc-push-offset');
    this.pushTarget = null;
  }

  private resolvePushTarget(): HTMLElement | null {
    const selector = this.getPushTargetSelector();
    if (!selector) { return null; }
    return document.querySelector(selector);
  }

  private getPushTargetSelector(): string | null {
    const host = window.location.host;
    if (PUSH_TARGETS_MAP[host]) {
      return PUSH_TARGETS_MAP[host];
    }
    for (const key of Object.keys(PUSH_TARGETS_MAP)) {
      if (host.endsWith(`.${key}`)) {
        return PUSH_TARGETS_MAP[key];
      }
    }
    return null;
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 刷新侧边栏
   */
  refresh(): void {
    if (!document.contains(this.toggleButton)) {
      this.createToggleButton();
    }
    if (!document.contains(this.sidebar)) {
      this.createSidebar();
    }
  }
}
