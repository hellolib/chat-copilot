/**
 * Popup Script
 */

import './styles.css';
import { QUICK_ACCESS_SITES, QuickAccessSite, ModelConfig, PROVIDER_ICONS } from '@shared/types';

class PopupApp {
  private allSites: QuickAccessSite[] = QUICK_ACCESS_SITES;

  async init(): Promise<void> {
    this.initTheme();
    this.loadIcon();
    this.loadVersion();
    await this.renderQuickAccess();
    await this.loadStats();
    await this.loadCurrentModel();
    await this.renderModelList();
    this.bindEvents();
    this.setupStorageListener();
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

  private loadIcon(): void {
    const iconEl = document.getElementById('popup-icon') as HTMLImageElement;
    if (iconEl) {
      iconEl.src = chrome.runtime.getURL('assets/chat-copilot-btn.svg');
    }
  }

  /**
   * 加载版本信息
   */
  private loadVersion(): void {
    const versionEl = document.getElementById('popup-version');
    if (versionEl) {
      const manifest = chrome.runtime.getManifest();
      versionEl.textContent = `v${manifest.version}`;
    }
  }

  /**
   * 渲染快速访问列表
   */
  private async renderQuickAccess(): Promise<void> {
    const container = document.getElementById('sites-grid');
    if (!container) { return; }

    // 从配置中读取启用的站点
    const result = await chrome.storage.local.get(['settings']);
    const enabledSiteIds = result.settings?.enabledQuickAccessSites ?? this.allSites.map(s => s.id);

    // 过滤出启用的站点
    const enabledSites = this.allSites.filter(site => enabledSiteIds.includes(site.id));

    container.innerHTML = enabledSites
      .map(
        (site) => {
          const iconHtml = site.icon
            ? `<img src="${chrome.runtime.getURL(`assets/website-icons/${site.icon}`)}" alt="${site.name}" class="site-icon-img">`
            : '<span class="site-icon-text">🚀</span>';

          return `
            <button class="site-button" data-url="${site.url}" title="打开 ${site.name}">
              <div class="site-icon">${iconHtml}</div>
              <span class="site-name">${site.name}</span>
            </button>
          `;
        },
      )
      .join('');

    // 绑定点击事件
    container.querySelectorAll('.site-button').forEach((button) => {
      button.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const url = target.dataset.url;
        if (url) {
          chrome.tabs.create({ url });
        }
      });
    });
  }

  /**
   * 获取今日日期字符串 (YYYY-MM-DD)
   */
  private getTodayString(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  /**
   * 加载统计信息
   */
  private async loadStats(): Promise<void> {
    const today = this.getTodayString();
    const result = await chrome.storage.local.get(['daily_stats', 'total_count']);

    // 检查日期是否切换
    const dailyStats = result.daily_stats as { date: string; optimization_triggered: number } | undefined;
    let todayCount = 0;

    if (dailyStats && dailyStats.date === today) {
      todayCount = dailyStats.optimization_triggered ?? 0;
    }

    const totalCount = result.total_count ?? 0;

    const todayEl = document.getElementById('today-count');
    const totalEl = document.getElementById('total-count');

    if (todayEl) { todayEl.textContent = String(todayCount); }
    if (totalEl) { totalEl.textContent = String(totalCount); }
  }

  /**
   * 设置存储监听器，实时更新统计和快速访问
   */
  private setupStorageListener(): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        // 检查是否更新了统计相关的数据
        if (changes.daily_stats || changes.total_count) {
          this.loadStats();
        }
        // 检查是否更新了设置（包括快速访问配置和模型）
        if (changes.settings) {
          this.renderQuickAccess();
          this.loadCurrentModel();
          this.renderModelList();
        }
        // 检查是否更新了模型列表
        if (changes.models) {
          this.renderModelList();
        }
      }
    });
  }

  private async loadCurrentModel(): Promise<void> {
    const result = await chrome.storage.local.get(['settings', 'models']);
    const modelId = result.settings?.currentModelId ?? 'builtin-rules';
    const models = (result.models ?? []) as ModelConfig[];

    const modelEl = document.getElementById('current-model');
    const modelIconEl = document.getElementById('current-model-icon') as HTMLImageElement;

    if (modelEl) {
      if (modelId === 'builtin-rules') {
        modelEl.textContent = '内置优化引擎';
        if (modelIconEl) {
          modelIconEl.src = chrome.runtime.getURL('assets/models-icons/inner.svg');
          modelIconEl.alt = 'builtin';
          modelIconEl.style.display = 'block';
        }
      } else {
        const model = models.find((m) => m.id === modelId);
        modelEl.textContent = model?.name ?? '未知模型';
        if (modelIconEl && model) {
          const iconPath = PROVIDER_ICONS[model.provider] || 'compatible.svg';
          modelIconEl.src = chrome.runtime.getURL(`assets/models-icons/${iconPath}`);
          modelIconEl.alt = model.provider;
          modelIconEl.style.display = 'block';
        } else if (modelIconEl) {
          modelIconEl.style.display = 'none';
        }
      }
    }
  }

  /**
   * 渲染模型列表
   */
  private async renderModelList(): Promise<void> {
    const container = document.getElementById('model-list');
    if (!container) { return; }

    const result = await chrome.storage.local.get(['settings', 'models']);
    const currentModelId = result.settings?.currentModelId ?? 'builtin-rules';
    const models = (result.models ?? []) as ModelConfig[];

    // 内置优化引擎
    const builtinHtml = `
      <div class="model-option ${currentModelId === 'builtin-rules' ? 'active' : ''}" data-model-id="builtin-rules">
        <img src="${chrome.runtime.getURL('assets/models-icons/inner.svg')}" alt="builtin" class="model-option-icon">
        <div class="model-option-info">
          <span class="model-option-name">内置优化引擎</span>
          <span class="model-option-desc">系统内置规则模版</span>
        </div>
        ${currentModelId === 'builtin-rules' ? '<span class="model-option-check">✓</span>' : ''}
      </div>
    `;

    // 自定义模型
    const modelsHtml = models
      .map(
        (model) => {
          const iconPath = PROVIDER_ICONS[model.provider] || 'compatible.svg';
          return `
      <div class="model-option ${currentModelId === model.id ? 'active' : ''}" data-model-id="${model.id}">
        <img src="${chrome.runtime.getURL(`assets/models-icons/${iconPath}`)}" alt="${model.provider}" class="model-option-icon">
        <div class="model-option-info">
          <span class="model-option-name">${model.name}</span>
          <span class="model-option-desc">${model.model}</span>
        </div>
        ${currentModelId === model.id ? '<span class="model-option-check">✓</span>' : ''}
      </div>
    `;
        },
      )
      .join('');

    container.innerHTML = builtinHtml + modelsHtml;

    // 绑定点击事件
    container.querySelectorAll('.model-option').forEach((option) => {
      option.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLElement;
        const modelId = target.dataset.modelId;
        if (modelId) {
          await this.selectModel(modelId);
          this.toggleModelDropdown();
        }
      });
    });
  }

  /**
   * 选择模型
   */
  private async selectModel(modelId: string): Promise<void> {
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings ?? {};
    settings.currentModelId = modelId;
    await chrome.storage.local.set({ settings });

    // 更新显示
    await this.loadCurrentModel();
    await this.renderModelList();
  }

  /**
   * 切换模型下拉列表
   */
  private toggleModelDropdown(): void {
    const dropdown = document.getElementById('model-dropdown');
    const card = document.getElementById('model-card');
    const arrow = card?.querySelector('.model-arrow');

    if (dropdown && card && arrow) {
      const isVisible = dropdown.style.display !== 'none';
      dropdown.style.display = isVisible ? 'none' : 'block';
      arrow.textContent = '▼';
      // arrow.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
      card.classList.toggle('expanded', !isVisible);
    }
  }

  private bindEvents(): void {
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    const moreBtn = document.getElementById('btn-more');
    const moreDropdown = document.getElementById('more-dropdown');

    moreBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!moreDropdown) { return; }
      const isVisible = moreDropdown.style.display !== 'none';
      moreDropdown.style.display = isVisible ? 'none' : 'block';
    });

    moreDropdown?.querySelectorAll('.more-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const url = target.dataset.url;
        const action = target.dataset.action;

        if (action === 'open-about') {
          // 打开设置页面并滚动到关于章节
          const optionsUrl = chrome.runtime.getURL('options/index.html#section-about');
          chrome.tabs.create({ url: optionsUrl });
          window.close();
        } else if (url) {
          chrome.tabs.create({ url });
          window.close();
        }
      });
    });

    // 模型卡片点击事件
    document.getElementById('model-card')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleModelDropdown();
    });

    // 点击外部关闭下拉列表
    setTimeout(() => {
      document.addEventListener('click', (e) => {
        const card = document.getElementById('model-card');
        const dropdown = document.getElementById('model-dropdown');
        if (card && dropdown && dropdown.style.display !== 'none') {
          if (!card.contains(e.target as Node) && !dropdown.contains(e.target as Node)) {
            this.toggleModelDropdown();
          }
        }

        const more = document.getElementById('more-dropdown');
        const moreButton = document.getElementById('btn-more');
        if (more && moreButton && more.style.display !== 'none') {
          if (!more.contains(e.target as Node) && !moreButton.contains(e.target as Node)) {
            more.style.display = 'none';
          }
        }
      });
    }, 0);
  }
}

const app = new PopupApp();
app.init();
