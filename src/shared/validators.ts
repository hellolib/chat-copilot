/**
 * 配置验证器
 * 用于验证 API 配置的格式和必填字段
 */

import { ModelConfig, ModelProvider } from '@shared/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class ConfigValidator {
  /**
   * 验证模型配置
   */
  static validateModelConfig(config: Partial<ModelConfig>): ValidationResult {
    const errors: string[] = [];

    // 验证必填字段
    if (!config.name?.trim()) {
      errors.push('模型名称不能为空');
    }

    if (!config.provider?.trim()) {
      errors.push('服务商不能为空');
    }

    if (!config.apiKey?.trim()) {
      errors.push('API Key 不能为空');
    }

    if (!config.endpoint?.trim()) {
      errors.push('API 地址不能为空');
    }

    // 验证 endpoint 格式
    if (config.endpoint) {
      if (!this.isValidUrl(config.endpoint)) {
        errors.push('API 地址格式不正确，请输入有效的 URL');
      }

      // 检查是否是 HTTPS（生产环境建议）
      if (this.isValidUrl(config.endpoint) && !config.endpoint.startsWith('https://')) {
        if (!config.endpoint.startsWith('http://localhost') && !config.endpoint.startsWith('http://127.0.0.1')) {
          errors.push('建议使用 HTTPS 协议以确保安全性');
        }
      }
    }

    // 验证 API Key 格式（基本检查）
    if (config.apiKey) {
      if (config.apiKey.length < 10) {
        errors.push('API Key 长度过短，请检查是否正确');
      }

      // 检查是否包含非法字符
      if (!/^[a-zA-Z0-9\-_]+$/.test(config.apiKey)) {
        errors.push('API Key 包含非法字符');
      }
    }

    // 验证 model 字段（如果提供）
    if (config.model && !config.model.trim()) {
      errors.push('模型标识不能为空字符串');
    }

    // 验证数值字段
    if (config.maxTokens !== undefined) {
      if (!Number.isInteger(config.maxTokens) || config.maxTokens <= 0) {
        errors.push('最大 Token 数必须是正整数');
      }
      if (config.maxTokens > 100000) {
        errors.push('最大 Token 数超出合理范围（建议不超过 100000）');
      }
    }

    if (config.temperature !== undefined) {
      if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
        errors.push('Temperature 必须是 0 到 2 之间的数值');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证批量配置
   */
  static validateModelConfigs(configs: Partial<ModelConfig>[]): ValidationResult {
    const allErrors: string[] = [];

    configs.forEach((config, index) => {
      const result = this.validateModelConfig(config);
      if (!result.isValid) {
        result.errors.forEach(error => {
          allErrors.push(`配置 ${index + 1} (${config.name || '未命名'}): ${error}`);
        });
      }
    });

    // 检查重复的模型名称
    const names = configs.map(c => c.name).filter(Boolean);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length > 0) {
      allErrors.push(`存在重复的模型名称: ${duplicates.join(', ')}`);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
    };
  }

  /**
   * 验证 URL 格式
   */
  private static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  /**
   * 清理和标准化配置
   */
  static sanitizeModelConfig(config: Partial<ModelConfig>): Partial<ModelConfig> {
    const sanitized = { ...config };

    // 清理字符串字段的空格
    if (sanitized.name) {
      sanitized.name = sanitized.name.trim();
    }
    if (sanitized.provider) {
      sanitized.provider = sanitized.provider.trim() as ModelProvider;
    }
    if (sanitized.apiKey) {
      sanitized.apiKey = sanitized.apiKey.trim();
    }
    if (sanitized.endpoint) {
      sanitized.endpoint = sanitized.endpoint.trim();
      // 移除末尾的斜杠
      if (sanitized.endpoint.endsWith('/')) {
        sanitized.endpoint = sanitized.endpoint.slice(0, -1);
      }
    }
    if (sanitized.model) {
      sanitized.model = sanitized.model.trim();
    }

    // 确保数值字段的类型正确
    if (sanitized.maxTokens !== undefined) {
      sanitized.maxTokens = Math.floor(Number(sanitized.maxTokens));
    }
    if (sanitized.temperature !== undefined) {
      sanitized.temperature = Number(sanitized.temperature);
    }

    return sanitized;
  }
}