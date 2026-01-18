/**
 * Model Manager
 * 模型管理器，处理模型配置和 API 调用
 */

import { ModelConfig, OptimizeRequest, OptimizeResponse } from '@shared/types';
import { StorageManager } from './storage';
import { RulesEngine } from '../engines/rules';
import { getAdapter } from '../engines/adapters';
import { AppError, ErrorCode, ErrorHandler } from '@shared/errors';
import { SecurityChecker } from '../security';

export class ModelManager {
  private storageManager: StorageManager;
  private rulesEngine: RulesEngine;
  private securityChecker: SecurityChecker;

  constructor(storageManager: StorageManager) {
    this.storageManager = storageManager;
    this.rulesEngine = new RulesEngine();
    this.securityChecker = new SecurityChecker();
  }

  /**
   * 优化 Prompt
   */
  async optimize(request: OptimizeRequest): Promise<OptimizeResponse> {
    try {
      const settings = await this.storageManager.get<{ currentModelId: string }>('settings');
      const modelId = settings?.currentModelId ?? 'builtin-rules';

      // 使用内置规则引擎
      if (modelId === 'builtin-rules') {
        return this.rulesEngine.optimize(request.prompt);
      }

      // 使用自定义模型
      const models = await this.storageManager.getModels();
      const model = models.find((m) => m.id === modelId);

      if (!model) {
        ErrorHandler.logError(new Error(`Model not found: ${modelId}`), 'optimize');
        // 模型不存在时降级到内置规则
        return this.rulesEngine.optimize(request.prompt);
      }

      return await this.callModelAPI(model, request.prompt);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      ErrorHandler.logError(error, 'optimize');
      throw new AppError(ErrorCode.API_ERROR, '优化 Prompt 失败', error);
    }
  }

  /**
   * 获取用户自定义规则上下文
   */
  async getCustomRulesContext(): Promise<string> {
    const customRules = await this.storageManager.getCustomRules();
    const enabledRules = customRules.filter(r => r.enabled);

    if (enabledRules.length === 0) {
      return '';
    }

    const rulesText = enabledRules
      .map(rule => `- ${rule.name}: ${rule.content}`)
      .join('\n');

    return `\n\n用户自定义规则要求：\n${rulesText}\n请在遵循上述规则的基础上，处理用户的请求。`;
  }

  /**
   * 调用模型 API
   */
  private async callModelAPI(model: ModelConfig, prompt: string): Promise<OptimizeResponse> {
    try {
      const adapter = getAdapter(model.provider);
      return await adapter.optimize(model, prompt);
    } catch (error) {
      ErrorHandler.logError(error, `callModelAPI(${model.provider})`);
      if (error instanceof AppError) {
        throw error;
      }
      // 网络错误
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AppError(ErrorCode.NETWORK_ERROR, '网络连接失败', error);
      }
      throw new AppError(ErrorCode.API_ERROR, `模型 API 调用失败: ${model.name}`, error);
    }
  }

  /**
   * 测试模型连接
   */
  async testConnection(model: ModelConfig): Promise<boolean> {
    try {
      const adapter = getAdapter(model.provider);
      return await adapter.testConnection(model);
    } catch (error) {
      ErrorHandler.logError(error, `testConnection(${model.provider})`);
      return false;
    }
  }
}
