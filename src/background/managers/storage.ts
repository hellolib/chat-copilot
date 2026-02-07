/**
 * Storage Manager
 * 本地存储管理
 */

import {
  ModelConfig,
  UserSettings,
  QUICK_ACCESS_SITES,
  CustomRule,
  FLOATING_BUTTON_DRAWER_DEFAULT_ACTIONS,
} from '@shared/types';
import { AppError, ErrorCode, ErrorHandler } from '@shared/errors';

export class StorageManager {
  /**
   * 初始化默认设置
   */
  async initDefaults(): Promise<void> {
    try {
      // 默认禁用 yiyan、perplexity 和 qianwen，其他站点默认启用
      const defaultDisabledSites = ['yiyan', 'perplexity', 'qianwen'];
      // eslint-disable-next-line max-len
      const defaultEnabledSites = QUICK_ACCESS_SITES.map(site => site.id).filter(id => !defaultDisabledSites.includes(id));
      const drawerActionsVersion = 2;
      
      const defaults: UserSettings = {
        currentModelId: 'builtin-rules',
        language: 'zh-CN',
        enabledQuickAccessSites: defaultEnabledSites,
        promptMethodTagIds: ['roleplay'], // 默认选中角色扮演
        showFloatingButton: true,
        floatingButtonClickAction: 'prompt-plaza',
        floatingButtonDrawerActions: FLOATING_BUTTON_DRAWER_DEFAULT_ACTIONS,
        floatingButtonDrawerActionsVersion: drawerActionsVersion,
      };

      const existing = await this.get<UserSettings>('settings');
      if (!existing) {
        await this.set('settings', defaults);
      } else {
        const allSiteIds = QUICK_ACCESS_SITES.map(site => site.id);
        let shouldSave = false;

        // 如果已存在设置但没有 enabledQuickAccessSites，则添加默认值
        if (!existing.enabledQuickAccessSites) {
          // 默认禁用 yiyan、perplexity 和 qianwen，其他站点默认启用
          const defaultDisabledSites = ['yiyan', 'perplexity', 'qianwen'];
          existing.enabledQuickAccessSites = allSiteIds.filter(id => !defaultDisabledSites.includes(id));
          shouldSave = true;
        }

        // 兼容新增站点：把新增的 site id 合并进已启用列表（不移除用户已有配置）
        const enabled = new Set(existing.enabledQuickAccessSites);
        let changed = false;
        for (const id of allSiteIds) {
          if (!enabled.has(id)) {
            enabled.add(id);
            changed = true;
          }
        }
        if (changed) {
          existing.enabledQuickAccessSites = Array.from(enabled);
          shouldSave = true;
        }

        if (!existing.promptMethodTagIds) {
          existing.promptMethodTagIds = ['roleplay']; // 默认选中角色扮演
          shouldSave = true;
        }

        if (typeof existing.showFloatingButton !== 'boolean') {
          existing.showFloatingButton = true;
          shouldSave = true;
        }

        if (!existing.floatingButtonClickAction) {
          existing.floatingButtonClickAction = 'prompt-plaza';
          shouldSave = true;
        }

        if (!Array.isArray(existing.floatingButtonDrawerActions)) {
          existing.floatingButtonDrawerActions = FLOATING_BUTTON_DRAWER_DEFAULT_ACTIONS;
          shouldSave = true;
        } else {
          // 兼容旧字段：optimize -> official-site，并过滤非法值
          const rawActions = existing.floatingButtonDrawerActions as unknown as string[];
          const normalized = rawActions
            .map((id) => (id === 'optimize' ? 'official-site' : id))
            .filter((id) => id === 'prompt-plaza' || id === 'favorites' || id === 'settings' || id === 'official-site');
          if (normalized.join(',') !== rawActions.join(',')) {
            existing.floatingButtonDrawerActions = normalized;
            shouldSave = true;
          }
        }

        if (typeof existing.floatingButtonDrawerActionsVersion !== 'number') {
          existing.floatingButtonDrawerActionsVersion = drawerActionsVersion;
          shouldSave = true;
        }

        if (shouldSave) {
          await this.set('settings', existing);
        }
      }
    } catch (error) {
      ErrorHandler.logError(error, 'initDefaults');
      throw new AppError(ErrorCode.STORAGE_ERROR, '初始化默认设置失败', error);
    }
  }

  /**
   * 获取存储数据
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] ?? null;
    } catch (error) {
      ErrorHandler.logError(error, `get(${key})`);
      throw new AppError(ErrorCode.STORAGE_ERROR, `获取存储数据失败: ${key}`, error);
    }
  }

  /**
   * 设置存储数据
   */
  async set<T>(key: string, value: T): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      ErrorHandler.logError(error, `set(${key})`);
      // 检查是否是配额超限
      if (error instanceof Error && error.message.includes('QUOTA_BYTES')) {
        throw new AppError(ErrorCode.STORAGE_ERROR, '存储空间不足，请清理后重试', error);
      }
      throw new AppError(ErrorCode.STORAGE_ERROR, `保存存储数据失败: ${key}`, error);
    }
  }

  /**
   * 删除存储数据
   */
  async remove(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(key);
    } catch (error) {
      ErrorHandler.logError(error, `remove(${key})`);
      throw new AppError(ErrorCode.STORAGE_ERROR, `删除存储数据失败: ${key}`, error);
    }
  }

  /**
   * 获取所有模型配置
   */
  async getModels(): Promise<ModelConfig[]> {
    return (await this.get<ModelConfig[]>('models')) ?? [];
  }

  /**
   * 保存模型配置
   */
  async saveModels(models: ModelConfig[]): Promise<void> {
    await this.set('models', models);
  }

  /**
   * 获取今日日期字符串 (YYYY-MM-DD)
   */
  private getTodayString(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  /**
   * 记录优化统计
   */
  async recordOptimization(): Promise<void> {
    const today = this.getTodayString();
    
    // 获取当前统计
    const dailyStats = await this.get<{ date: string; optimization_triggered: number }>('daily_stats');
    const totalCount = (await this.get<number>('total_count')) ?? 0;

    // 检查日期是否切换
    if (!dailyStats || dailyStats.date !== today) {
      // 新的一天，重置今日统计
      await this.set('daily_stats', {
        date: today,
        optimization_triggered: 1,
      });
    } else {
      // 同一天，增加计数
      await this.set('daily_stats', {
        date: today,
        optimization_triggered: (dailyStats.optimization_triggered ?? 0) + 1,
      });
    }

    // 更新累计统计
    await this.set('total_count', totalCount + 1);
  }

  /**
   * 获取今日优化次数
   */
  async getTodayCount(): Promise<number> {
    const today = this.getTodayString();
    const dailyStats = await this.get<{ date: string; optimization_triggered: number }>('daily_stats');
    
    if (!dailyStats || dailyStats.date !== today) {
      return 0;
    }
    
    return dailyStats.optimization_triggered ?? 0;
  }

  /**
   * 获取累计优化次数
   */
  async getTotalCount(): Promise<number> {
    return (await this.get<number>('total_count')) ?? 0;
  }

  /**
   * 获取用户自定义优化规则
   */
  async getCustomRules(): Promise<CustomRule[]> {
    return (await this.get<CustomRule[]>('custom_rules')) ?? [];
  }

  /**
   * 保存用户自定义优化规则
   */
  async saveCustomRules(rules: CustomRule[]): Promise<void> {
    await this.set('custom_rules', rules);
  }

  /**
   * 添加自定义优化规则
   */
  async addCustomRule(rule: Omit<CustomRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomRule> {
    const rules = await this.getCustomRules();
    const now = Date.now();
    const newRule: CustomRule = {
      ...rule,
      id: `custom-rule-${now}`,
      createdAt: now,
      updatedAt: now,
    };
    rules.push(newRule);
    await this.saveCustomRules(rules);
    return newRule;
  }

  /**
   * 更新自定义优化规则
   */
  async updateCustomRule(id: string, updates: Partial<CustomRule>): Promise<void> {
    const rules = await this.getCustomRules();
    const index = rules.findIndex(r => r.id === id);
    if (index === -1) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `规则不存在: ${id}`);
    }
    rules[index] = {
      ...rules[index],
      ...updates,
      id: rules[index].id,
      createdAt: rules[index].createdAt,
      updatedAt: Date.now(),
    };
    await this.saveCustomRules(rules);
  }

  /**
   * 删除自定义优化规则
   */
  async deleteCustomRule(id: string): Promise<void> {
    const rules = await this.getCustomRules();
    const filtered = rules.filter(r => r.id !== id);
    if (filtered.length === rules.length) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `规则不存在: ${id}`);
    }
    await this.saveCustomRules(filtered);
  }
}
