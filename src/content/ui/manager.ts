/**
 * UI Manager
 * 管理注入到页面的 UI 组件
 */

import { PlatformAdapter, MessageType, OptimizeResponse, MessageResponse, ModelConfig, PROVIDER_ICONS } from '@shared/types';
import { ErrorHandler, AppError, ErrorCode } from '@shared/errors';
import { PromptSidebar } from './promptSidebar';
import { createLogoUseSvg } from './logoSprite';
import { FloatingButton } from './floatingButton';
import { Toast } from '@shared/toast';
import { enhancePromptWithCustomRules } from '../utils/customRules';

export class UIManager {
  private adapter: PlatformAdapter;
  private button: HTMLElement | null = null;
  private isInjected = false;
  private retryCount = 0;
  private maxRetries = 3;
  private abortController: AbortController | null = null;
  private currentDialog: HTMLElement | null = null;
  private isLoading = false;
  private themeDetectTimeout: ReturnType<typeof setTimeout> | null = null;
  private tooltip: HTMLElement | null = null;
  private floatingButton: FloatingButton;
  private promptSidebar: PromptSidebar;
  private showFloatingButton = true;
  private floatingButtonClickAction: 'optimize' | 'prompt-plaza' | 'favorites' | 'none' | 'settings' = 'prompt-plaza';

  constructor(adapter: PlatformAdapter) {
    this.adapter = adapter;
    this.promptSidebar = new PromptSidebar(adapter);
    this.floatingButton = new FloatingButton({
      getExtensionURL: this.getExtensionURL.bind(this),
      onClick: () => this.handleFloatingButtonClick(),
      actions: [
        {
          id: 'prompt-plaza',
          label: '提示词广场',
          onClick: () => this.promptSidebar.openTab('square'),
        },
        {
          id: 'favorites',
          label: '我的收藏',
          onClick: () => this.promptSidebar.openTab('favorites'),
        },
        {
          id: 'settings',
          label: '插件设置',
          onClick: () => this.requestOpenOptionsPage(),
        },
      ],
    });
  }

  /**
   * 检查扩展上下文是否有效
   */
  private isExtensionContextValid(): boolean {
    try {
      // 尝试访问 chrome.runtime.id，如果上下文失效会抛出错误
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  }

  /**
   * 安全地获取扩展资源 URL
   */
  private getExtensionURL(path: string): string {
    try {
      if (!this.isExtensionContextValid()) {
        throw new AppError(ErrorCode.EXTENSION_CONTEXT_INVALIDATED, 'Extension context invalidated');
      }
      return chrome.runtime.getURL(path);
    } catch (error) {
      ErrorHandler.logError(error, 'getExtensionURL');
      // 返回一个占位符或空字符串
      return '';
    }
  }

  private async loadFloatingButtonSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['settings']);
      this.showFloatingButton = result.settings?.showFloatingButton ?? true;
      this.floatingButtonClickAction = result.settings?.floatingButtonClickAction ?? 'prompt-plaza';
      this.floatingButton.setVisible(this.showFloatingButton);
    } catch (error) {
      ErrorHandler.logError(error, 'loadFloatingButtonSettings');
    }
  }

  private setupSettingsListener(): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes.settings) {return;}
      const newSettings = changes.settings.newValue;
      if (newSettings && typeof newSettings.showFloatingButton === 'boolean') {
        this.showFloatingButton = newSettings.showFloatingButton;
        this.floatingButton.setVisible(this.showFloatingButton);
      }
      if (newSettings?.floatingButtonClickAction) {
        this.floatingButtonClickAction = newSettings.floatingButtonClickAction;
      }
    });
  }

  private handleFloatingButtonClick(): void {
    if (this.floatingButtonClickAction === 'none') {
      return;
    }
    if (this.floatingButtonClickAction === 'prompt-plaza') {
      this.promptSidebar.openTab('square');
      return;
    }
    if (this.floatingButtonClickAction === 'favorites') {
      this.promptSidebar.openTab('favorites');
      return;
    }
    if (this.floatingButtonClickAction === 'settings') {
      this.requestOpenOptionsPage();
      return;
    }
    this.handleOptimize();
  }

  private requestOpenOptionsPage(): void {
    if (!this.isExtensionContextValid()) {
      Toast.error('扩展已更新，请刷新页面后重试');
      return;
    }

    chrome.runtime.sendMessage({ type: MessageType.OPEN_OPTIONS }, (response: MessageResponse) => {
      if (!response?.success) {
        Toast.error(response?.error || '打开设置页失败');
      }
    });
  }

  /**
   * 初始化 UI
   */
  init(): void {
    this.initTheme();
    this.initTooltip();
    this.floatingButton.init();
    void this.loadFloatingButtonSettings();
    this.setupSettingsListener();
    this.injectButton();
    this.promptSidebar.init();
  }

  /**
   * 初始化 Tooltip (Portal 模式)
   */
  private initTooltip(): void {
    if (document.querySelector('.chat-copilot-btn-tooltip')) {return;}

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'chat-copilot-btn-tooltip';
    this.tooltip.textContent = '优化提示词';
    document.body.appendChild(this.tooltip);
  }

  /**
   * 更新 Tooltip 位置
   */
  private updateTooltipPosition(): void {
    if (!this.button || !this.tooltip) {return;}

    const rect = this.button.getBoundingClientRect();
    // 居中显示在按钮上方，保持 8px 间距
    const left = rect.left + rect.width / 2;
    const top = rect.top - 8;

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  /**
   * 初始化主题检测
   */
  private initTheme(): void {
    // 检测宿主页面的主题
    const detectTheme = (): void => {
      // 检查是否有 data-theme 属性
      const htmlTheme = document.documentElement.getAttribute('data-theme');
      if (htmlTheme) {
        document.documentElement.setAttribute('data-theme', htmlTheme);
        if (htmlTheme === 'dark') {
          document.body.classList.add('dark');
        } else {
          document.body.classList.remove('dark');
        }
        return;
      }

      // 检查是否有 dark 类
      if (document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark')) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark');
        return;
      }

      // 检查系统主题
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = prefersDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', theme);

      if (theme === 'dark') {
        document.body.classList.add('dark');
      } else {
        document.body.classList.remove('dark');
      }
    };

    // 初始检测
    detectTheme();

    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', detectTheme);

    // 监听DOM变化，检测宿主页面主题变化
    const observer = new MutationObserver(() => {
      // 防抖：避免频繁检测主题
      if (this.themeDetectTimeout !== null) {
        clearTimeout(this.themeDetectTimeout);
      }

      this.themeDetectTimeout = setTimeout(() => {
        detectTheme();
        this.themeDetectTimeout = null;
      }, 100);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
      subtree: false,
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: false,
    });
  }

  /**
   * 刷新 UI（处理动态加载）
   */
  refresh(): void {
    if (!this.isInjected || !document.contains(this.button)) {
      this.injectButton();
    }
    if (this.showFloatingButton) {
      this.floatingButton.refresh();
    }
    this.promptSidebar.refresh();
  }

  /**
   * 注入优化按钮
   */
  private injectButton(): void {
    // 检查是否已注入
    if (document.querySelector('.chat-copilot-btn')) {
      // 如果按钮存在但不在DOM中，重新注入
      if (this.button && !document.contains(this.button)) {
        this.button = null;
        this.isInjected = false;
      } else {
        return;
      }
    }

    // ChatGPT 特殊处理：等待 cursor-text div 出现
    if (this.adapter.name === 'ChatGPT') {
      const cursorTextDiv = document.querySelector('div.cursor-text');

      if (!cursorTextDiv) {
        // cursor-text div 还不存在，延迟重试
        this.retryCount++;

        if (this.retryCount > this.maxRetries) {
          return;
        }

        setTimeout(() => this.injectButton(), 500);
        return;
      }

      // 找到了，重置重试计数
      this.retryCount = 0;
    } else if (this.adapter.name === 'DeepSeek' || this.adapter.name === '元宝') {
      // DeepSeek 和元宝特殊处理：检查输入框是否存在
      const inputElement = this.adapter.getInputElement();

      if (!inputElement) {
        // 输入框还不存在，延迟重试
        this.retryCount++;

        if (this.retryCount > this.maxRetries) {
          return;
        }

        setTimeout(() => this.injectButton(), 500);
        return;
      }
      // 找到了，重置重试计数
      this.retryCount = 0;
    } else {
      // 其他平台检查发送按钮，增加重试机制
      const sendButton = this.adapter.getSendButton();
      if (!sendButton) {
        this.retryCount++;

        if (this.retryCount > this.maxRetries) {
          return;
        }

        setTimeout(() => this.injectButton(), 500);
        return;
      }
      // 找到了，重置重试计数
      this.retryCount = 0;
    }
    this.button = this.createButton();
    this.adapter.injectButton(this.button);
    this.isInjected = true;
  }

  /**
   * 创建优化按钮
   */
  private createButton(): HTMLElement {
    const button = document.createElement('button');
    button.className = 'chat-copilot-btn';
    button.innerHTML = '';

    const svg = createLogoUseSvg('chat-copilot-btn-icon', 18);
    svg.style.width = '18px';
    svg.style.height = '18px';
    svg.style.display = 'block';
    svg.style.margin = 'auto';
    svg.style.pointerEvents = 'none';
    button.appendChild(svg);

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (this.isLoading) {
        this.cancelOptimize();
      } else {
        this.handleOptimize();
      }
    });

    // Tooltip 悬浮事件
    button.addEventListener('mouseenter', () => {
      if (!this.tooltip) {this.initTooltip();}
      this.updateTooltipPosition();
      this.tooltip?.classList.add('visible');
    });

    button.addEventListener('mouseleave', () => {
      this.tooltip?.classList.remove('visible');
    });

    return button;
  }

  private getLogoSvgHtml(): string {
    const logoUrl = chrome.runtime.getURL('assets/chat-copilot-btn.svg');
    return `
      <span class="chat-copilot-logo" aria-hidden="true" style="--cc-logo-url: url('${logoUrl}'); width: 18px; height: 18px; display: block;"></span>
    `;
  }

  /**
   * 处理优化请求
   */
  private async handleOptimize(updateExistingDialog = false, promptText?: string): Promise<void> {
    if (this.isLoading && !updateExistingDialog) {
      return;
    }

    const prompt = promptText || this.adapter.getInputValue();

    if (!prompt.trim()) {
      Toast.warning('请先输入内容');
      return;
    }

    // 检查扩展上下文是否有效
    if (!this.isExtensionContextValid()) {
      Toast.error('扩展已更新，请刷新页面后重试');
      return;
    }

    // 创建新的 AbortController
    this.abortController = new AbortController();

    this.isLoading = true;
    this.setButtonLoading(true);

    // 如果是更新现有对话框，显示加载状态
    if (updateExistingDialog && this.currentDialog) {
      this.setDialogLoading(true);
    }

    try {
      const response = (await chrome.runtime.sendMessage({
        type: MessageType.OPTIMIZE_PROMPT,
        payload: { prompt, platform: this.adapter.name },
      })) as MessageResponse<OptimizeResponse> | undefined;

      // 检查是否被取消
      if (this.abortController?.signal.aborted) {
        return;
      }

      // 检查响应是否有效（扩展上下文失效时可能返回 undefined）
      if (!response) {
        throw new AppError(ErrorCode.EXTENSION_CONTEXT_INVALIDATED, 'Extension context invalidated');
      }

      if (response.success && response.data) {
        if (updateExistingDialog && this.currentDialog) {
          // 更新现有对话框
          await this.updateCompareDialog(response.data);
        } else {
          // 显示新对话框
          await this.showCompareDialog(response.data);
        }
      } else {
        Toast.error(response.error || '优化失败，请重试');
      }
    } catch (error) {
      // 检查是否是用户取消
      if (error instanceof Error && error.name === 'AbortError') {
        Toast.info('已取消优化');
        return;
      }

      ErrorHandler.logError(error, 'handleOptimize');
      const errorMessage = ErrorHandler.getErrorMessage(error);
      Toast.error(errorMessage);
    } finally {
      this.isLoading = false;
      this.setButtonLoading(false);
      if (updateExistingDialog && this.currentDialog) {
        this.setDialogLoading(false);
      }
      this.abortController = null;
    }
  }

  /**
   * 取消优化请求
   */
  private cancelOptimize(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      this.isLoading = false;
      this.setButtonLoading(false);
      Toast.info('已取消优化');
    }
  }

  /**
   * 获取当前模型信息
   */
  private async getCurrentModelInfo(): Promise<{ name: string; icon: string; isBuiltin: boolean }> {
    try {
      const result = await chrome.storage.local.get(['settings', 'models']);
      const modelId = result.settings?.currentModelId ?? 'builtin-rules';

      if (modelId === 'builtin-rules') {
        return {
          name: '内置优化引擎',
          icon: this.getExtensionURL('assets/models-icons/inner.svg'),
          isBuiltin: true,
        };
      }

      const models = result.models ?? [];
      const model = models.find((m: ModelConfig) => m.id === modelId);
      if (model) {
        const iconPath = PROVIDER_ICONS[model.provider as keyof typeof PROVIDER_ICONS] || 'compatible.svg';
        return {
          name: model.name,
          icon: this.getExtensionURL(`assets/models-icons/${iconPath}`),
          isBuiltin: false,
        };
      }

      return {
        name: '未知模型',
        icon: this.getExtensionURL('assets/models-icons/compatible.svg'),
        isBuiltin: false,
      };
    } catch {
      return {
        name: '内置优化引擎',
        icon: this.getExtensionURL('assets/models-icons/inner.svg'),
        isBuiltin: true,
      };
    }
  }

  /**
   * 显示对比弹窗
   */
  private async showCompareDialog(result: OptimizeResponse): Promise<void> {
    // 移除已存在的弹窗
    document.querySelector('.chat-copilot-dialog')?.remove();
    this.currentDialog = null;
    document.body.classList.remove('chat-copilot-modal-open');

    // 获取模型信息
    const modelInfo = await this.getCurrentModelInfo();

    const logoSvg = this.getLogoSvgHtml();

    const dialog = document.createElement('div');
    dialog.className = 'chat-copilot-dialog';
    dialog.innerHTML = `
      <div class="chat-copilot-dialog-content">
        <div class="chat-copilot-dialog-header">
          <div class="chat-copilot-header-left">
            <div class="chat-copilot-model-info">
              ${modelInfo.icon ? `<img src="${modelInfo.icon}" class="chat-copilot-model-icon" alt="model" />` : ''}
              <span>${this.escapeHtml(modelInfo.name)}</span>
            </div>
            ${modelInfo.isBuiltin ? `
              <div class="chat-copilot-model-tip">
                <span>内置优化引擎效果有限，建议</span>
                <button class="chat-copilot-model-tip-action" type="button">添加自定义模型</button>
              </div>
            ` : ''}
          </div>
          <button class="chat-copilot-close">&times;</button>
        </div>
        <div class="chat-copilot-dialog-body">
          <div class="chat-copilot-compare">
            <div class="chat-copilot-original">
              <h4 class="chat-copilot-label">原始内容</h4>
              <div class="chat-copilot-content-box">
                <textarea class="chat-copilot-original-textarea">${this.escapeHtml(result.original)}</textarea>
              </div>
            </div>
            <div class="chat-copilot-optimized">
              <h4 class="chat-copilot-label">优化内容</h4>
              <div class="chat-copilot-content-box">
                <textarea class="chat-copilot-optimized-textarea">${this.escapeHtml(result.optimized)}</textarea>
              </div>
            </div>
          </div>
        </div>
        <div class="chat-copilot-dialog-footer">
          <button class="chat-copilot-btn-reoptimize">重新优化</button>
          <button class="chat-copilot-btn-apply">应用</button>
          <button class="chat-copilot-btn-copy">复制</button>
          <button class="chat-copilot-btn-cancel">取消</button>
        </div>
      </div>
    `;

    const enterModalState = () => {
      document.body.classList.add('chat-copilot-modal-open');
      const floatingWrapper = document.querySelector('.chat-copilot-floating-wrapper');
      if (floatingWrapper) {
        floatingWrapper.classList.remove('drawer-open', 'drawer-open-down');
      }
    };
    const closeDialog = () => {
      dialog.remove();
      document.body.classList.remove('chat-copilot-modal-open');
    };

    // 事件绑定
    dialog.querySelector('.chat-copilot-close')?.addEventListener('click', closeDialog);
    dialog.querySelector('.chat-copilot-btn-cancel')?.addEventListener('click', closeDialog);
    dialog.querySelector('.chat-copilot-btn-apply')?.addEventListener('click', async () => {
      const optimizedTextarea = dialog.querySelector('.chat-copilot-optimized-textarea') as HTMLTextAreaElement;
      const optimizedText = optimizedTextarea?.value || result.optimized;
      const enhancedPrompt = await enhancePromptWithCustomRules(optimizedText);
      this.adapter.setInputValue(enhancedPrompt);
      closeDialog();
      Toast.success('已应用优化');
    });
    dialog.querySelector('.chat-copilot-btn-copy')?.addEventListener('click', () => {
      const optimizedTextarea = dialog.querySelector('.chat-copilot-optimized-textarea') as HTMLTextAreaElement;
      const optimizedText = optimizedTextarea?.value || result.optimized;
      navigator.clipboard.writeText(optimizedText);
      Toast.success('已复制到剪贴板');
    });
    dialog.querySelector('.chat-copilot-btn-reoptimize')?.addEventListener('click', async () => {
      // 获取当前弹窗中的原始内容
      const originalTextarea = dialog.querySelector('.chat-copilot-original-textarea') as HTMLTextAreaElement;
      const originalText = originalTextarea?.value || '';
      // 不关闭弹窗，直接更新内容
      await this.handleOptimize(true, originalText);
    });
    dialog.querySelector('.chat-copilot-model-tip-action')?.addEventListener('click', () => {
      this.requestOpenOptionsPage();
    });

    document.body.appendChild(dialog);
    this.currentDialog = dialog;
    enterModalState();
  }

  /**
   * 更新对比弹窗内容
   */
  private async updateCompareDialog(result: OptimizeResponse): Promise<void> {
    if (!this.currentDialog) { return; }

    // 获取模型信息
    const modelInfoData = await this.getCurrentModelInfo();

    // 更新模型信息
    const modelInfoContainer = this.currentDialog.querySelector('.chat-copilot-model-info');
    if (modelInfoContainer) {
      modelInfoContainer.innerHTML = `
        ${modelInfoData.icon ? `<img src="${modelInfoData.icon}" class="chat-copilot-model-icon" alt="model" />` : ''}
        <span>${this.escapeHtml(modelInfoData.name)}</span>
      `;
    }

    // 更新内置模型提示
    const headerLeft = this.currentDialog.querySelector('.chat-copilot-header-left');
    const existingTip = this.currentDialog.querySelector('.chat-copilot-model-tip');
    if (modelInfoData.isBuiltin) {
      if (!existingTip && headerLeft) {
        headerLeft.insertAdjacentHTML(
          'beforeend',
          `
            <div class="chat-copilot-model-tip">
              <span>内置优化引擎效果有限，建议</span>
              <button class="chat-copilot-model-tip-action" type="button">添加自定义模型</button>
            </div>
          `,
        );
        headerLeft.querySelector('.chat-copilot-model-tip-action')?.addEventListener('click', () => {
          this.requestOpenOptionsPage();
        });
      }
    } else {
      existingTip?.remove();
    }

    // 更新原始内容
    const originalContent = this.currentDialog.querySelector('.chat-copilot-original .chat-copilot-content-box textarea');
    if (originalContent) {
      originalContent.textContent = result.original;
    }

    // 更新优化内容
    const optimizedContent = this.currentDialog.querySelector('.chat-copilot-optimized .chat-copilot-content-box textarea');
    if (optimizedContent) {
      optimizedContent.textContent = result.optimized;
    }
  }

  /**
   * 设置对话框加载状态
   */
  private setDialogLoading(loading: boolean): void {
    if (!this.currentDialog) { return; }

    const dialogBody = this.currentDialog.querySelector('.chat-copilot-dialog-body');
    if (!dialogBody) { return; }

    if (loading) {
      dialogBody.classList.add('loading');

      // 禁用所有按钮
      const buttons = this.currentDialog.querySelectorAll('button');
      buttons.forEach(btn => {
        (btn as HTMLButtonElement).disabled = true;
      });
    } else {
      dialogBody.classList.remove('loading');

      // 启用所有按钮
      const buttons = this.currentDialog.querySelectorAll('button');
      buttons.forEach(btn => {
        (btn as HTMLButtonElement).disabled = false;
      });
    }
  }

  /**
   * 设置按钮加载状态
   */
  private setButtonLoading(loading: boolean): void {
    if (this.button) {
      if (loading) {
        // 创建加载动画
        this.button.innerHTML = `
          <div class="chat-copilot-spinner"></div>
        `;
      } else {
        // 恢复 SVG 图标
        this.button.innerHTML = '';
        try {
          const svgNS = 'http://www.w3.org/2000/svg';
          const svg = document.createElementNS(svgNS, 'svg');
          svg.setAttribute('viewBox', '0 0 1024 1024');
          svg.setAttribute('width', '18');
          svg.setAttribute('height', '18');
          svg.style.width = '18px';
          svg.style.height = '18px';
          svg.style.display = 'block';
          svg.style.margin = 'auto';
          svg.style.pointerEvents = 'none';

          const path = document.createElementNS(svgNS, 'path');
          path.setAttribute('d', 'M568.888889 964.266667c-39.822222 0-82.488889-8.533333-128-25.6-108.088889-39.822222-196.266667-176.355556-238.933333-253.155556-22.755556-39.822222-11.377778-93.866667 25.6-122.311111 39.822222-31.288889 96.711111-28.444444 133.688888 5.688889v-193.422222c0-39.822222 34.133333-73.955556 73.955556-73.955556s73.955556 34.133333 73.955556 73.955556v59.733333c8.533333-5.688889 19.911111-8.533333 31.288888-8.533333 34.133333 0 62.577778 22.755556 71.111112 51.2 11.377778-5.688889 22.755556-8.533333 36.977777-8.533334 34.133333 0 62.577778 22.755556 71.111111 51.2 11.377778-5.688889 22.755556-8.533333 36.977778-8.533333 39.822222 0 73.955556 34.133333 73.955556 73.955556v167.822222c0 28.444444-8.533333 54.044444-22.755556 76.8-25.6 36.977778-65.422222 85.333333-119.466666 105.244444-39.822222 19.911111-76.8 28.444444-119.466667 28.444445z m-275.911111-381.155556c-14.222222 0-25.6 5.688889-36.977778 14.222222-22.755556 17.066667-28.444444 45.511111-14.222222 68.266667 39.822222 71.111111 122.311111 196.266667 216.177778 233.244444 85.333333 31.288889 145.066667 31.288889 219.022222 0 45.511111-19.911111 82.488889-65.422222 99.555555-91.022222 8.533333-14.222222 14.222222-31.288889 14.222223-51.2v-167.822222c0-17.066667-14.222222-31.288889-31.288889-31.288889s-31.288889 14.222222-31.288889 31.288889c0 11.377778-8.533333 22.755556-22.755556 22.755556s-22.755556-14.222222-22.755555-25.6v-42.666667c0-17.066667-14.222222-31.288889-31.288889-31.288889s-31.288889 14.222222-31.288889 31.288889c0 11.377778-8.533333 22.755556-22.755556 22.755555s-22.755556-8.533333-22.755555-22.755555v-42.666667c0-17.066667-14.222222-31.288889-31.288889-31.288889S512 483.555556 512 500.622222c0 11.377778-8.533333 22.755556-22.755556 22.755556s-22.755556-8.533333-22.755555-22.755556v-128c0-17.066667-14.222222-31.288889-31.288889-31.288889s-31.288889 14.222222-31.288889 31.288889v244.622222c0 8.533333-5.688889 17.066667-14.222222 19.911112-8.533333 2.844444-17.066667 2.844444-22.755556-5.688889L332.8 597.333333c-8.533333-8.533333-25.6-14.222222-39.822222-14.222222zM321.422222 278.755556c-5.688889 0-11.377778-2.844444-14.222222-5.688889L241.777778 207.644444c-8.533333-8.533333-8.533333-22.755556 0-31.288888s22.755556-8.533333 31.288889 0l65.422222 65.422222c8.533333 8.533333 8.533333 22.755556 0 31.288889-8.533333 2.844444-14.222222 5.688889-17.066667 5.688889zM426.666667 236.088889c-11.377778 0-19.911111-8.533333-19.911111-17.066667l-22.755556-128c-2.844444-11.377778 5.688889-22.755556 17.066667-25.6 11.377778-2.844444 22.755556 5.688889 25.6 17.066667l22.755555 128c2.844444 11.377778-5.688889 22.755556-17.066666 25.6-2.844444-2.844444-5.688889 0-5.688889 0zM531.911111 256c-2.844444 0-8.533333 0-11.377778-2.844444-8.533333-5.688889-11.377778-19.911111-5.688889-28.444445l42.666667-65.422222c5.688889-8.533333 19.911111-11.377778 28.444445-5.688889 8.533333 5.688889 11.377778 19.911111 5.688888 28.444444l-42.666666 65.422223c-2.844444 5.688889-8.533333 8.533333-17.066667 8.533333z');
          path.setAttribute('fill', 'currentColor');
          svg.appendChild(path);
          this.button.appendChild(svg);
        } catch (error) {
          ErrorHandler.logError(error, 'setButtonLoading');
          this.button.textContent = '✨';
          this.button.style.fontSize = '18px';
        }
      }
      this.button.classList.toggle('loading', loading);
    }
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
   * 切换提示词广场侧边栏
   */
  togglePromptSidebar(): void {
    this.promptSidebar.toggle();
  }
}
