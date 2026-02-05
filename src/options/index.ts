/**
 * Options Page Script
 */

import './styles.css';
import {
  ModelConfig,
  ModelProvider,
  MODEL_PRESETS,
  MessageType,
  QUICK_ACCESS_SITES,
  PROVIDER_ICONS,
  CustomRule,
  PROMPT_METHOD_TAGS,
  PromptMethodTagId,
} from '@shared/types';
import {ConfigValidator} from '@shared/validators';
import {Toast} from '@shared/toast';

class OptionsApp {
  private models: ModelConfig[] = [];
  private selectedProvider: ModelProvider = 'openai';
  private currentModelId: string = 'builtin-rules';
  private editingModelId: string | null = null;
  private customRules: CustomRule[] = [];
  private editingCustomRuleId: string | null = null;
  private promptMethodTagIds: PromptMethodTagId[] = [];

  async init(): Promise<void> {
    this.initTheme();
    this.loadVersion();
    await this.loadModels();
    await this.loadSettings();
    await this.loadCustomRules();
    this.renderPromptMethodTags();
    this.bindEvents();
    this.bindFloatingActionSelect();
    this.renderModelList();
    await this.renderQuickAccess();
    await this.renderCustomRules();
    this.updateOptimizationAvailability();
    await this.loadFloatingButtonSettings();
    await this.loadPromptSidebarSettings();
    this.initSidebarNavigation();
    // 处理页面加载时的 hash 导航
    this.handleHashNavigation();
  }

  /**
   * 初始化侧边栏导航
   */
  private initSidebarNavigation(): void {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.options-main > .section[id]');

    // 点击导航项
    navItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = (item as HTMLElement).dataset.section;
        if (targetId) {
          const targetSection = document.getElementById(targetId);
          if (targetSection) {
            targetSection.scrollIntoView({behavior: 'smooth', block: 'start'});
            this.updateActiveNavItem(targetId);
          }
        }
      });
    });

    // 滚动时更新高亮
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.updateActiveNavItem(entry.target.id);
        }
      });
    }, observerOptions);

    sections.forEach((section) => {
      observer.observe(section);
    });
  }

  /**
   * 更新导航项高亮状态
   */
  private updateActiveNavItem(sectionId: string): void {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((item) => {
      if ((item as HTMLElement).dataset.section === sectionId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  /**
   * 处理页面加载时的 hash 导航
   */
  private handleHashNavigation(): void {
    const hash = window.location.hash.slice(1); // 去掉 # 号
    if (hash) {
      // 等待 DOM 渲染完成后滚动
      requestAnimationFrame(() => {
        const targetSection = document.getElementById(hash);
        if (targetSection) {
          targetSection.scrollIntoView({behavior: 'smooth', block: 'start'});
          this.updateActiveNavItem(hash);
        }
      });
    }
  }

  /**
   * 初始化主题
   */
  private initTheme(): void {
    // 检测系统主题偏好
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // 从存储中读取用户设置的主题
    chrome.storage.local.get(['theme'], (result) => {
      const theme = result.theme || (prefersDark ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);

      if (theme === 'dark') {
        document.body.classList.add('dark');
      } else {
        document.body.classList.remove('dark');
      }
    });

    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      chrome.storage.local.get(['theme'], (result) => {
        // 只有在用户没有手动设置主题时才跟随系统
        if (!result.theme) {
          const theme = e.matches ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', theme);
          if (theme === 'dark') {
            document.body.classList.add('dark');
          } else {
            document.body.classList.remove('dark');
          }
        }
      });
    });
  }

  /**
   * 加载版本信息
   */
  private loadVersion(): void {
    const versionEl = document.getElementById('options-version');
    if (versionEl) {
      const manifest = chrome.runtime.getManifest();
      versionEl.textContent = `v${manifest.version}`;
    }
  }

  private async loadModels(): Promise<void> {
    const result = await chrome.storage.local.get(['models']);
    this.models = result.models ?? [];
  }

  private async loadSettings(): Promise<void> {
    const result = await chrome.storage.local.get(['settings']);
    this.currentModelId = result.settings?.currentModelId ?? 'builtin-rules';
    this.promptMethodTagIds = result.settings?.promptMethodTagIds ?? ['roleplay'];
  }

  private renderModelList(): void {
    const container = document.getElementById('model-list');
    if (!container) {
      return;
    }

    const isBuiltinSelected = this.currentModelId === 'builtin-rules';
    const builtinHtml = `
      <div class="model-item">
        <input type="radio" name="model" value="builtin-rules" ${isBuiltinSelected ? 'checked' : ''}>
        <img src="${chrome.runtime.getURL('assets/models-icons/inner.svg')}" alt="builtin" class="model-provider-icon">
        <div class="model-info">
          <span class="model-name">内置优化引擎</span>
          <span class="model-desc">系统内置规则模版</span>
        </div>
      </div>
    `;

    const modelsHtml = this.models
      .map(
        (m) => {
          const iconPath = PROVIDER_ICONS[m.provider] || 'compatible.svg';
          const isSelected = this.currentModelId === m.id;
          return `
      <div class="model-item" data-id="${m.id}">
        <input type="radio" name="model" value="${m.id}" ${isSelected ? 'checked' : ''}>
        <img src="${chrome.runtime.getURL(`assets/models-icons/${iconPath}`)}" alt="${m.provider}" class="model-provider-icon">
        <div class="model-info" data-id="${m.id}">
          <span class="model-name">${m.name}</span>
          <span class="model-desc">${MODEL_PRESETS[m.provider]?.name ?? m.provider} · ${m.model}</span>
        </div>
        <div class="model-actions">
          <button class="btn-test btn-test-inline" data-id="${m.id}">测试</button>
          <button class="btn-edit" data-id="${m.id}">编辑</button>
        <button class="btn-delete ${isSelected ? 'disabled' : ''}" data-id="${m.id}" ${isSelected ? 'disabled' : ''}>删除</button>
        </div>
      </div>
    `;
        },
      )
      .join('');

    container.innerHTML = builtinHtml + modelsHtml;

    // 绑定删除事件
    container.querySelectorAll('.btn-delete:not(:disabled)').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).dataset.id;
        if (id) {
          this.deleteModel(id);
        }
      });
    });

    // 绑定编辑事件
    container.querySelectorAll('.btn-edit').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).dataset.id;
        if (id) {
          this.startEditModel(id);
        }
      });
    });

    // 绑定测试事件
    container.querySelectorAll('.btn-test-inline').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.target as HTMLElement).dataset.id;
        if (id) {
          this.testModel(id);
        }
      });
    });

    // 绑定选择事件
    container.querySelectorAll('input[name="model"]').forEach((input) => {
      input.addEventListener('change', (e) => {
        const value = (e.target as HTMLInputElement).value;
        this.selectModel(value);
      });
    });
  }

  private bindEvents(): void {
    // 添加模型按钮
    document.getElementById('btn-add-model')?.addEventListener('click', () => {
      this.startCreateModel();
    });

    // 取消按钮
    document.getElementById('btn-cancel')?.addEventListener('click', () => {
      this.hideModelForm();
    });

    // 测试连接
    document.getElementById('btn-test')?.addEventListener('click', () => {
      this.testConnection();
    });

    // 保存模型
    document.getElementById('model-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveModel();
    });

    // 提供商下拉选择 (隐藏的原始 select，用于兼容已有逻辑)
    document.getElementById('model-provider')?.addEventListener('change', (e) => {
      const provider = (e.target as HTMLSelectElement).value as ModelProvider;
      this.updateCustomSelect(provider);
      this.selectProvider(provider);
    });

    // 自定义下拉菜单逻辑
    const customSelect = document.getElementById('model-provider-custom');
    const trigger = document.getElementById('select-trigger');
    const options = document.getElementById('select-options');

    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      customSelect?.classList.toggle('active');
    });

    options?.querySelectorAll('.select-option').forEach((option) => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = (option as HTMLElement).dataset.value as ModelProvider;
        const providerSelect = document.getElementById('model-provider') as HTMLSelectElement;

        if (providerSelect) {
          providerSelect.value = value;
          // 手动触发 change 事件
          providerSelect.dispatchEvent(new Event('change'));
        }

        customSelect?.classList.remove('active');
      });
    });

    // 点击外部关闭
    document.addEventListener('click', () => {
      customSelect?.classList.remove('active');
    });

    // 全选按钮
    document.getElementById('btn-select-all')?.addEventListener('click', () => {
      this.selectAllQuickAccess();
    });

    // 反选按钮
    document.getElementById('btn-invert-selection')?.addEventListener('click', () => {
      this.invertQuickAccessSelection();
    });

    // 恢复默认设置按钮
    document.getElementById('btn-reset-quick-access')?.addEventListener('click', () => {
      this.resetQuickAccessToDefault();
    });

    // 悬浮按钮开关
    document.getElementById('show-floating-button-toggle')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this.saveFloatingButtonSettings(checked);
    });

    // 悬浮按钮点击动作
    document.getElementById('floating-button-click-action')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value as 'optimize' | 'prompt-plaza' | 'favorites' | 'none' | 'settings';
      this.saveFloatingButtonClickAction(value);
    });

    // 提示词广场侧边栏弹出方式
    document.getElementById('prompt-sidebar-push-toggle')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this.savePromptSidebarSettings(checked);
    });

    // 自定义优化规则相关
    document.getElementById('btn-add-custom-rule')?.addEventListener('click', () => {
      this.showCustomRuleForm();
    });

    document.getElementById('btn-cancel-custom-rule')?.addEventListener('click', () => {
      this.hideCustomRuleForm();
    });

    document.getElementById('custom-rule-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveCustomRule();
    });

    document.getElementById('prompt-methods-list')?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target && target.classList.contains('prompt-method-checkbox')) {
        this.savePromptMethodTags();
      }
    });
  }

  private renderPromptMethodTags(): void {
    const container = document.getElementById('prompt-methods-list');
    if (!container) {
      return;
    }

    container.innerHTML = PROMPT_METHOD_TAGS
      .map((tag) => {
        const checked = this.promptMethodTagIds.includes(tag.id) ? 'checked' : '';
        return `
          <label class="prompt-method-tag">
            <input type="checkbox" class="prompt-method-checkbox" data-id="${tag.id}" ${checked}>
            <span class="prompt-method-title">${this.escapeHtml(tag.name)}</span>
          </label>
        `;
      })
      .join('');
  }

  private bindFloatingActionSelect(): void {
    const customSelect = document.getElementById('floating-action-custom');
    const trigger = document.getElementById('floating-action-trigger');
    const options = document.getElementById('floating-action-options');
    const iconContainer = document.getElementById('floating-action-icon');
    const nativeSelect = document.getElementById('floating-button-click-action') as HTMLSelectElement | null;

    if (!customSelect || !trigger || !options || !nativeSelect || !iconContainer) {
      return;
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      customSelect.classList.toggle('active');
    });

    options.querySelectorAll('.select-option').forEach((option) => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = (option as HTMLElement).dataset.value as 'optimize' | 'prompt-plaza' | 'favorites' | 'none' | 'settings';
        const label = option.querySelector('span')?.textContent?.trim() ?? '';
        const icon = option.querySelector('svg')?.outerHTML ?? '';

        options.querySelectorAll('.select-option').forEach((opt) => opt.classList.remove('selected'));
        option.classList.add('selected');

        const selectedValue = trigger.querySelector('.selected-value');
        if (selectedValue) {
          selectedValue.textContent = label;
        }
        iconContainer.innerHTML = icon;

        nativeSelect.value = value;
        nativeSelect.dispatchEvent(new Event('change'));

        customSelect.classList.remove('active');
      });
    });

    document.addEventListener('click', () => {
      customSelect.classList.remove('active');
    });
  }

  private async savePromptMethodTags(): Promise<void> {
    const container = document.getElementById('prompt-methods-list');
    if (!container) {
      return;
    }

    const selectedIds: PromptMethodTagId[] = [];
    container.querySelectorAll<HTMLInputElement>('.prompt-method-checkbox').forEach((checkbox) => {
      if (checkbox.checked) {
        const id = checkbox.dataset.id as PromptMethodTagId;
        if (id) {
          selectedIds.push(id);
        }
      }
    });

    this.promptMethodTagIds = selectedIds;
    await this.saveSettings({promptMethodTagIds: selectedIds});
  }

  private updateOptimizationAvailability(): void {
    const isBuiltinSelected = this.currentModelId === 'builtin-rules';
    this.toggleSectionDisabled('section-prompt-methods', isBuiltinSelected);
    this.toggleSectionDisabled('section-custom-rules', isBuiltinSelected);

    const promptContainer = document.getElementById('prompt-methods-list');
    promptContainer?.querySelectorAll<HTMLInputElement>('.prompt-method-checkbox').forEach((checkbox) => {
      checkbox.disabled = isBuiltinSelected;
    });

    const addCustomRuleButton = document.getElementById('btn-add-custom-rule') as HTMLButtonElement | null;
    if (addCustomRuleButton) {
      addCustomRuleButton.disabled = isBuiltinSelected;
    }

    const customRulesContainer = document.getElementById('custom-rules-list');
    customRulesContainer?.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      button.disabled = isBuiltinSelected;
    });

    if (isBuiltinSelected) {
      this.hideCustomRuleForm();
    }
  }

  private toggleSectionDisabled(sectionId: string, disabled: boolean): void {
    const section = document.getElementById(sectionId);
    if (!section) {
      return;
    }
    section.classList.toggle('is-disabled', disabled);
    section.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    if (disabled) {
      section.setAttribute('data-disabled-hint', '使用内置优化引擎时不可用，请切换为自定义模型以启用。');
    } else {
      section.removeAttribute('data-disabled-hint');
    }
  }

  private selectProvider(provider: ModelProvider): void {
    this.selectedProvider = provider;

    // 预填充表单
    const preset = MODEL_PRESETS[provider];
    if (preset) {
      const endpointInput = document.getElementById('model-endpoint') as HTMLInputElement;
      const _nameInput = document.getElementById('model-name') as HTMLInputElement;
      const _modelInput = document.getElementById('model-model') as HTMLInputElement;
      const apikeyGroup = document.getElementById('apikey-group') as HTMLElement;

      // 仅在创建新模型时自动填充默认值，编辑模式下保留用户原有配置
      if (!this.editingModelId) {
        if (endpointInput) {
          endpointInput.value = preset.endpoint;
        }
        // 只保留 API 端点的默认值，其他字段不填充
      }

      // 显示/隐藏 API Key 字段
      if (apikeyGroup) {
        apikeyGroup.style.display = preset.requiresApiKey ? 'block' : 'none';
      }
    }
  }

  /**
   * 更新自定义下拉框的 UI 状态
   */
  private updateCustomSelect(provider: ModelProvider): void {
    const customSelect = document.getElementById('model-provider-custom');
    const selectedValue = customSelect?.querySelector('.selected-value');
    const triggerIcon = document.getElementById('select-trigger-icon') as HTMLImageElement;
    const options = customSelect?.querySelectorAll('.select-option');

    // 获取显示名称
    const providerSelect = document.getElementById('model-provider') as HTMLSelectElement;
    let displayName = provider as string;
    if (providerSelect) {
      const option = Array.from(providerSelect.options).find(opt => opt.value === provider);
      if (option) {
        displayName = option.text;
      }
    }

    if (selectedValue) {
      selectedValue.textContent = displayName;
    }

    // 更新触发器图标
    if (triggerIcon) {
      const iconPath = PROVIDER_ICONS[provider] || 'compatible.svg';
      triggerIcon.src = chrome.runtime.getURL(`assets/models-icons/${iconPath}`);
    }

    options?.forEach(opt => {
      if ((opt as HTMLElement).dataset.value === provider) {
        opt.classList.add('selected');
      } else {
        opt.classList.remove('selected');
      }
    });
  }

  private showModelForm(): void {
    const backdrop = document.getElementById('model-modal-backdrop');
    if (backdrop) {
      backdrop.style.display = 'flex';
    }

    // 更新标题
    const titleElement = document.querySelector('#model-form-section h2');
    if (titleElement) {
      titleElement.textContent = this.editingModelId ? '编辑模型' : '添加自定义模型';
    }
  }

  private hideModelForm(): void {
    const backdrop = document.getElementById('model-modal-backdrop');
    if (backdrop) {
      backdrop.style.display = 'none';
    }
    (document.getElementById('model-form') as HTMLFormElement)?.reset();
    this.editingModelId = null;
  }

  /**
   * 新建模型：重置表单并使用默认预设
   */
  private startCreateModel(): void {
    this.editingModelId = null;

    const form = document.getElementById('model-form') as HTMLFormElement | null;
    form?.reset();

    // 默认选中 OpenAI 并填充预设
    const providerSelect = document.getElementById('model-provider') as HTMLSelectElement | null;
    if (providerSelect) {
      providerSelect.value = 'openai';
    }
    this.updateCustomSelect('openai');
    this.selectProvider('openai');

    this.showModelForm();
  }

  /**
   * 编辑已有模型：根据 id 回填表单
   */
  private startEditModel(id: string): void {
    const model = this.models.find((m) => m.id === id);
    if (!model) {
      return;
    }

    this.editingModelId = id;

    const providerSelect = document.getElementById('model-provider') as HTMLSelectElement | null;
    const nameInput = document.getElementById('model-name') as HTMLInputElement | null;
    const endpointInput = document.getElementById('model-endpoint') as HTMLInputElement | null;
    const apikeyInput = document.getElementById('model-apikey') as HTMLInputElement | null;
    const modelInput = document.getElementById('model-model') as HTMLInputElement | null;

    if (providerSelect) {
      providerSelect.value = model.provider;
    }
    if (nameInput) {
      nameInput.value = model.name;
    }
    if (endpointInput) {
      endpointInput.value = model.endpoint;
    }
    if (apikeyInput) {
      apikeyInput.value = model.apiKey ?? '';
    }
    if (modelInput) {
      modelInput.value = model.model;
    }

    // 应用 provider 对 API Key 显示等的控制逻辑
    this.updateCustomSelect(model.provider);
    this.selectProvider(model.provider);

    this.showModelForm();
  }

  private async testConnection(): Promise<void> {
    const name = (document.getElementById('model-name') as HTMLInputElement).value || '临时测试模型';
    const provider = (document.getElementById('model-provider') as HTMLSelectElement).value as ModelProvider;
    const endpoint = (document.getElementById('model-endpoint') as HTMLInputElement).value;
    const apiKey = (document.getElementById('model-apikey') as HTMLInputElement).value || undefined;
    const modelName = (document.getElementById('model-model') as HTMLInputElement).value;

    // 创建临时配置
    const config: Partial<ModelConfig> = {
      name,
      provider,
      endpoint,
      apiKey,
      model: modelName,
    };

    // 清理和标准化配置
    const sanitizedConfig = ConfigValidator.sanitizeModelConfig(config);

    // 验证配置
    const validation = ConfigValidator.validateModelConfig(sanitizedConfig);
    if (!validation.isValid) {
      this.showValidationErrors(validation.errors);
      return;
    }

    const payload: ModelConfig = {
      ...sanitizedConfig as ModelConfig,
      id: 'test-model',
      enabled: true,
    };

    const btn = document.getElementById('btn-test') as HTMLButtonElement;
    const originalText = btn.textContent;
    btn.textContent = '测试中...';
    btn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.TEST_CONNECTION,
        payload,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const success = (response as any).data?.connected;
      this.showTestResult(success, success ? '连接成功！' : '连接失败，请检查配置');
    } catch (error) {
      this.showTestResult(false, '测试失败: ' + (error as Error).message);
    } finally {
      btn.textContent = originalText || '测试连接';
      btn.disabled = false;
    }
  }

  private async testModel(id: string): Promise<void> {
    const model = this.models.find((m) => m.id === id);
    if (!model) {
      this.showTestResult(false, '模型不存在');
      return;
    }

    const btn = document.querySelector(`[data-id="${id}"].btn-test-inline`) as HTMLButtonElement;
    const originalText = btn?.textContent;
    if (btn) {
      btn.textContent = '测试中...';
      btn.disabled = true;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.TEST_CONNECTION,
        payload: model,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const success = (response as any).data?.connected;
      this.showTestResult(success, success ? `模型 "${model.name}" 连接成功` : `模型 "${model.name}" 连接失败`);
    } catch (error) {
      this.showTestResult(false, '测试失败: ' + (error as Error).message);
    } finally {
      if (btn) {
        btn.textContent = originalText || '测试';
        btn.disabled = false;
      }
    }
  }

  private async saveModel(): Promise<void> {
    const name = (document.getElementById('model-name') as HTMLInputElement).value;
    const provider = (document.getElementById('model-provider') as HTMLSelectElement).value as ModelProvider;
    const endpoint = (document.getElementById('model-endpoint') as HTMLInputElement).value;
    const apiKey = (document.getElementById('model-apikey') as HTMLInputElement).value || undefined;
    const modelName = (document.getElementById('model-model') as HTMLInputElement).value;

    // 创建配置对象
    const config: Partial<ModelConfig> = {
      name,
      provider,
      endpoint,
      apiKey,
      model: modelName,
    };

    // 清理和标准化配置
    const sanitizedConfig = ConfigValidator.sanitizeModelConfig(config);

    // 验证配置
    const validation = ConfigValidator.validateModelConfig(sanitizedConfig);
    if (!validation.isValid) {
      this.showValidationErrors(validation.errors);
      return;
    }

    if (this.editingModelId) {
      // 更新已有模型
      this.models = this.models.map((m) =>
        m.id === this.editingModelId
          ? {
            ...m,
            ...sanitizedConfig,
          }
          : m,
      );
    } else {
      // 新建模型
      const model: ModelConfig = {
        ...sanitizedConfig as ModelConfig,
        id: `model-${Date.now()}`,
        enabled: true,
      };

      this.models.push(model);
    }

    await chrome.storage.local.set({models: this.models});

    this.hideModelForm();
    this.renderModelList();
    this.updateOptimizationAvailability();
  }

  private async deleteModel(id: string): Promise<void> {
    const model = this.models.find((m) => m.id === id);
    if (!model) {
      return;
    }

    const confirmed = window.confirm(`确定要删除模型 "${model.name}" 吗？此操作不可撤销。`);
    if (!confirmed) {
      return;
    }

    this.models = this.models.filter((m) => m.id !== id);
    await chrome.storage.local.set({models: this.models});

    // 如果删除的是当前选中的模型，切换到内置优化引擎
    if (this.currentModelId === id) {
      this.currentModelId = 'builtin-rules';
      const result = await chrome.storage.local.get(['settings']);
      const settings = result.settings ?? {};
      settings.currentModelId = 'builtin-rules';
      await chrome.storage.local.set({settings});
    }

    this.renderModelList();
  }

  private async selectModel(modelId: string): Promise<void> {
    this.currentModelId = modelId;
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings ?? {};
    settings.currentModelId = modelId;
    await chrome.storage.local.set({settings});

    // 重新渲染列表以更新删除按钮状态
    this.renderModelList();
    this.updateOptimizationAvailability();
  }

  /**
   * 显示验证错误
   */
  private showValidationErrors(errors: string[]): void {
    const container = this.getOrCreateMessageContainer();
    container.className = 'message-container error';
    container.innerHTML = `
      <div class="message-title">配置验证失败</div>
      <ul class="error-list">
        ${errors.map(err => `<li>${err}</li>`).join('')}
      </ul>
    `;
    this.showMessage(container);
  }

  /**
   * 显示测试结果
   */
  private showTestResult(success: boolean, message: string): void {
    if (success) {
      Toast.success(message);
    } else {
      Toast.error(message);
    }
  }

  /**
   * 获取或创建消息容器
   */
  private getOrCreateMessageContainer(): HTMLElement {
    let container = document.getElementById('message-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'message-container';
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * 显示消息
   */
  private showMessage(container: HTMLElement): void {
    container.style.display = 'block';
    container.style.opacity = '1';

    // 3秒后自动隐藏
    setTimeout(() => {
      container.style.opacity = '0';
      setTimeout(() => {
        container.style.display = 'none';
      }, 300);
    }, 3000);
  }

  private async saveSettings(partial: Record<string, unknown>): Promise<void> {
    const result = await chrome.storage.local.get(['settings']);
    const settings = {...result.settings, ...partial};
    await chrome.storage.local.set({settings});
  }

  /**
   * 渲染快速访问配置列表
   */
  private async renderQuickAccess(): Promise<void> {
    const container = document.getElementById('quick-access-list');
    if (!container) {
      return;
    }

    const result = await chrome.storage.local.get(['settings']);
    // 默认启用除 yiyan、perplexity 和 qianwen 之外的所有站点
    const defaultDisabledSites = ['yiyan', 'perplexity', 'qianwen'];
    const defaultEnabledSites = QUICK_ACCESS_SITES.map(s => s.id).filter(id => !defaultDisabledSites.includes(id));
    const enabledSiteIds = result.settings?.enabledQuickAccessSites ?? defaultEnabledSites;

    container.innerHTML = QUICK_ACCESS_SITES
      .map(
        (site) => {
          const isEnabled = enabledSiteIds.includes(site.id);
          const iconHtml = site.icon
            ? `<img src="${chrome.runtime.getURL(`assets/website-icons/${site.icon}`)}" alt="${site.name}" class="quick-access-icon-img">`
            : '<span class="quick-access-icon-text">🚀</span>';

          return `
            <div class="quick-access-item">
              <label class="quick-access-label">
                <input type="checkbox" class="quick-access-checkbox" data-site-id="${site.id}" ${isEnabled ? 'checked' : ''}>
                <div class="quick-access-icon">${iconHtml}</div>
                <span class="quick-access-name">${site.name}</span>
              </label>
            </div>
          `;
        },
      )
      .join('');

    // 绑定复选框变化事件
    container.querySelectorAll('.quick-access-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        this.saveQuickAccessSettings();
      });
    });
  }

  /**
   * 保存快速访问设置
   */
  private async saveQuickAccessSettings(): Promise<void> {
    const checkboxes = document.querySelectorAll('.quick-access-checkbox') as NodeListOf<HTMLInputElement>;
    const enabledSiteIds: string[] = [];

    checkboxes.forEach((checkbox) => {
      if (checkbox.checked) {
        const siteId = checkbox.dataset.siteId;
        if (siteId) {
          enabledSiteIds.push(siteId);
        }
      }
    });

    await this.saveSettings({enabledQuickAccessSites: enabledSiteIds});
  }

  /**
   * 全选快速访问站点
   */
  private async selectAllQuickAccess(): Promise<void> {
    const checkboxes = document.querySelectorAll('.quick-access-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((checkbox) => {
      checkbox.checked = true;
    });
    await this.saveQuickAccessSettings();
  }

  /**
   * 反选快速访问站点
   */
  private async invertQuickAccessSelection(): Promise<void> {
    const checkboxes = document.querySelectorAll('.quick-access-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((checkbox) => {
      checkbox.checked = !checkbox.checked;
    });
    await this.saveQuickAccessSettings();
  }

  /**
   * 恢复快速访问为默认设置
   */
  private async resetQuickAccessToDefault(): Promise<void> {
    // 立刻写回默认的快速访问设置
    const defaultDisabledSites = ['yiyan', 'perplexity', 'qianwen'];
    const defaultEnabledSites = QUICK_ACCESS_SITES.map(site => site.id)
      .filter(id => !defaultDisabledSites.includes(id));

    const result = await chrome.storage.local.get(['settings']);
    const settings = { ...result.settings, enabledQuickAccessSites: defaultEnabledSites };
    await chrome.storage.local.set({ settings });

    // 重新渲染列表
    await this.renderQuickAccess();
  }

  /**
   * 加载悬浮按钮设置
   */
  private async loadFloatingButtonSettings(): Promise<void> {
    const result = await chrome.storage.local.get(['settings']);
    const showFloatingButton = result.settings?.showFloatingButton ?? true;
    const clickAction = result.settings?.floatingButtonClickAction ?? 'prompt-plaza';

    const toggle = document.getElementById('show-floating-button-toggle') as HTMLInputElement;
    if (toggle) {
      toggle.checked = showFloatingButton;
    }

    const actionSelect = document.getElementById('floating-button-click-action') as HTMLSelectElement;
    if (actionSelect) {
      actionSelect.value = clickAction;
    }

    const actionCustom = document.getElementById('floating-action-custom');
    const actionOptions = document.getElementById('floating-action-options');
    const actionTrigger = document.getElementById('floating-action-trigger');
    const actionIcon = document.getElementById('floating-action-icon');
    if (actionCustom && actionOptions && actionTrigger) {
      actionOptions.querySelectorAll('.select-option').forEach((option) => {
        option.classList.toggle('selected', (option as HTMLElement).dataset.value === clickAction);
      });
      const selectedOption = actionOptions.querySelector(`.select-option[data-value="${clickAction}"]`);
      const label = selectedOption?.querySelector('span')?.textContent?.trim() ?? '提示词广场';
      const selectedValue = actionTrigger.querySelector('.selected-value');
      if (selectedValue) {
        selectedValue.textContent = label;
      }
      if (actionIcon) {
        actionIcon.innerHTML = selectedOption?.querySelector('svg')?.outerHTML ?? '';
      }
    }
  }

  /**
   * 加载提示词广场侧边栏设置
   */
  private async loadPromptSidebarSettings(): Promise<void> {
    const result = await chrome.storage.local.get(['settings']);
    const pushModeEnabled = result.settings?.promptSidebarPushMode ?? true;

    const toggle = document.getElementById('prompt-sidebar-push-toggle') as HTMLInputElement;
    if (toggle) {
      toggle.checked = pushModeEnabled;
    }
  }

  /**
   * 保存悬浮按钮设置
   */
  private async saveFloatingButtonSettings(showToggle: boolean): Promise<void> {
    await this.saveSettings({showFloatingButton: showToggle});
  }

  private async saveFloatingButtonClickAction(
    action: 'optimize' | 'prompt-plaza' | 'favorites' | 'none' | 'settings',
  ): Promise<void> {
    await this.saveSettings({floatingButtonClickAction: action});
  }

  /**
   * 保存提示词广场侧边栏设置
   */
  private async savePromptSidebarSettings(pushModeEnabled: boolean): Promise<void> {
    await this.saveSettings({promptSidebarPushMode: pushModeEnabled});
  }

  /**
   * 加载自定义优化规则
   */
  private async loadCustomRules(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.GET_CUSTOM_RULES,
      });
      if (response.success) {
        this.customRules = response.data || [];
      }
    } catch (error) {
      console.error('Failed to load custom rules:', error);
      this.customRules = [];
    }
  }

  /**
   * 渲染自定义优化规则列表
   */
  private async renderCustomRules(): Promise<void> {
    const container = document.getElementById('custom-rules-list');
    if (!container) {
      return;
    }

    if (this.customRules.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无自定义优化规则，点击下方按钮添加</p>';
      return;
    }

    container.innerHTML = this.customRules
      .map(
        (rule) => `
        <div class="custom-rule-item ${rule.enabled ? 'enabled' : 'disabled'}">
          <div class="custom-rule-main">
            <div class="custom-rule-header">
              <span class="custom-rule-name">${this.escapeHtml(rule.name)}</span>
              <span class="custom-rule-badge">${rule.enabled ? '已启用' : '已禁用'}</span>
            </div>
            <div class="custom-rule-content">
              ${this.escapeHtml(rule.content)}
            </div>
          </div>
          <div class="custom-rule-actions">
            <button class="btn-toggle-rule" data-id="${rule.id}">
              ${rule.enabled ? '禁用' : '启用'}
            </button>
            <button class="btn-edit-rule" data-id="${rule.id}">编辑</button>
            <button class="btn-delete-rule" data-id="${rule.id}">删除</button>
          </div>
        </div>
      `,
      )
      .join('');

    container.querySelectorAll('.btn-toggle-rule').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).dataset.id;
        if (id) {
          this.toggleCustomRule(id);
        }
      });
    });

    container.querySelectorAll('.btn-edit-rule').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).dataset.id;
        if (id) {
          this.editCustomRule(id);
        }
      });
    });

    container.querySelectorAll('.btn-delete-rule').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).dataset.id;
        if (id) {
          this.deleteCustomRule(id);
        }
      });
    });
  }

  /**
   * 显示自定义优化规则表单
   */
  private showCustomRuleForm(): void {
    this.editingCustomRuleId = null;
    const title = document.getElementById('custom-rule-modal-title');
    const form = document.getElementById('custom-rule-form') as HTMLFormElement;
    const _nameInput = document.getElementById('custom-rule-name') as HTMLInputElement;
    const _contentInput = document.getElementById('custom-rule-content') as HTMLTextAreaElement;
    const enabledInput = document.getElementById('custom-rule-enabled') as HTMLInputElement;

    if (title) {
      title.textContent = '添加自定义优化规则';
    }
    if (form) {
      form.reset();
    }
    if (enabledInput) {
      enabledInput.checked = true;
    }

    const backdrop = document.getElementById('custom-rule-modal-backdrop');
    if (backdrop) {
      backdrop.style.display = 'flex';
    }
  }

  /**
   * 隐藏自定义优化规则表单
   */
  private hideCustomRuleForm(): void {
    const backdrop = document.getElementById('custom-rule-modal-backdrop');
    if (backdrop) {
      backdrop.style.display = 'none';
    }
    this.editingCustomRuleId = null;
  }

  /**
   * 编辑自定义优化规则
   */
  private editCustomRule(id: string): void {
    const rule = this.customRules.find((r) => r.id === id);
    if (!rule) {
      return;
    }

    this.editingCustomRuleId = id;

    const title = document.getElementById('custom-rule-modal-title');
    const _nameInput = document.getElementById('custom-rule-name') as HTMLInputElement;
    const _contentInput = document.getElementById('custom-rule-content') as HTMLTextAreaElement;
    const enabledInput = document.getElementById('custom-rule-enabled') as HTMLInputElement;

    if (title) {
      title.textContent = '编辑自定义优化规则';
    }
    if (_nameInput) {
      _nameInput.value = rule.name;
    }
    if (_contentInput) {
      _contentInput.value = rule.content;
    }
    if (enabledInput) {
      enabledInput.checked = rule.enabled;
    }

    const backdrop = document.getElementById('custom-rule-modal-backdrop');
    if (backdrop) {
      backdrop.style.display = 'flex';
    }
  }

  /**
   * 保存自定义优化规则
   */
  private async saveCustomRule(): Promise<void> {
    const nameInput = document.getElementById('custom-rule-name') as HTMLInputElement;
    const contentInput = document.getElementById('custom-rule-content') as HTMLTextAreaElement;
    const enabledInput = document.getElementById('custom-rule-enabled') as HTMLInputElement;

    const name = nameInput.value.trim();
    const content = contentInput.value.trim();
    const enabled = enabledInput.checked;

    if (!name || !content) {
      Toast.error('请填写规则名称和内容');
      return;
    }

    try {
      if (this.editingCustomRuleId) {
        await this.updateCustomRule(this.editingCustomRuleId, {name, content, enabled});
        Toast.success('规则更新成功');
      } else {
        const response = await chrome.runtime.sendMessage({
          type: MessageType.SAVE_CUSTOM_RULES,
          payload: {name, content, enabled},
        });

        if (response.success) {
          Toast.success('规则添加成功');
        } else {
          Toast.error(response.error || '保存失败');
          return;
        }
      }

      await this.loadCustomRules();
      await this.renderCustomRules();
      this.hideCustomRuleForm();
    } catch (error) {
      console.error('Failed to save custom rule:', error);
      Toast.error('保存规则失败: ' + (error as Error).message);
    }
  }

  /**
   * 更新自定义优化规则
   */
  private async updateCustomRule(id: string, updates: Partial<CustomRule>): Promise<void> {
    const index = this.customRules.findIndex((r) => r.id === id);
    if (index === -1) {
      return;
    }

    this.customRules[index] = {
      ...this.customRules[index],
      ...updates,
      updatedAt: Date.now(),
    };

    await chrome.storage.local.set({custom_rules: this.customRules});
  }

  /**
   * 切换自定义优化规则启用状态
   */
  private async toggleCustomRule(id: string): Promise<void> {
    const rule = this.customRules.find((r) => r.id === id);
    if (!rule) {
      return;
    }

    await this.updateCustomRule(id, {enabled: !rule.enabled});
    await this.renderCustomRules();
  }

  /**
   * 删除自定义优化规则
   */
  private async deleteCustomRule(id: string): Promise<void> {
    const rule = this.customRules.find((r) => r.id === id);
    if (!rule) {
      return;
    }

    const confirmed = window.confirm(`确定要删除规则 "${rule.name}" 吗？此操作不可撤销。`);
    if (!confirmed) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.DELETE_CUSTOM_RULE,
        payload: id,
      });

      if (response.success) {
        Toast.success('规则删除成功');
        await this.loadCustomRules();
        await this.renderCustomRules();
      } else {
        Toast.error(response.error || '删除失败');
      }
    } catch (error) {
      console.error('Failed to delete custom rule:', error);
      Toast.error('删除规则失败: ' + (error as Error).message);
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
}

const app = new OptionsApp();
app.init();
