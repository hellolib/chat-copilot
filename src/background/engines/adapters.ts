/**
 * Model API Adapters
 * 各模型提供商的 API 适配器
 */

import { ModelConfig, ModelProvider, OptimizeResponse } from '@shared/types';

// 系统提示词：限制输出只是一条可直接使用的 Prompt，避免元话语和示例
const SYSTEM_PROMPT = `你是专业的 Prompt 优化助手。请仅输出一段可直接用于大模型的优化后提示词，不要添加任何说明、示例、前后缀或引号。

请在结果中包含：
1) 角色/身份
2) 任务与输入要素
3) 约束（安全、长度、避免冒犯等）
4) 输出格式或风格要求（若原始需求已有则保留或精炼）

禁止在结果中出现“示例如下”“请直接输出”“无需额外说明”等元话语。`;

const USER_PROMPT_TEMPLATE = (prompt: string) =>
  `在保持原意的前提下，精炼并补全以下需求，使其更清晰、可执行。仅返回优化后的提示词本身：\n\n${prompt}`;

/**
 * API 适配器接口
 */
export interface APIAdapter {
  optimize(config: ModelConfig, prompt: string): Promise<OptimizeResponse>;
  testConnection(config: ModelConfig): Promise<boolean>;
}

/**
 * OpenAI 兼容 API 适配器（OpenAI、Grok、OpenRouter、Ollama）
 */
export class OpenAIAdapter implements APIAdapter {
  async optimize(config: ModelConfig, prompt: string): Promise<OptimizeResponse> {
    const response = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { Authorization: `Bearer ${config.apiKey}` }),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: USER_PROMPT_TEMPLATE(prompt) },
        ],
        max_tokens: config.maxTokens ?? 2048,
        temperature: config.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const optimizedPrompt = this.cleanOutput(
      data.choices?.[0]?.message?.content ?? prompt,
    );

    return {
      original: prompt,
      optimized: optimizedPrompt.trim(),
      improvements: this.analyzeImprovements(prompt, optimizedPrompt),
    };
  }

  async testConnection(config: ModelConfig): Promise<boolean> {
    try {
      const response = await fetch(`${config.endpoint}/models`, {
        method: 'GET',
        headers: {
          ...(config.apiKey && { Authorization: `Bearer ${config.apiKey}` }),
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private analyzeImprovements(original: string, optimized: string): string[] {
    const improvements: string[] = [];
    if (optimized.length > original.length * 1.5) {
      improvements.push('补充了详细内容');
    }
    if (optimized.includes('角色') || optimized.includes('扮演')) {
      improvements.push('添加了角色设定');
    }
    if (optimized.includes('格式') || optimized.includes('输出')) {
      improvements.push('明确了输出格式');
    }
    if (improvements.length === 0) {
      improvements.push('AI 模型优化');
    }
    return improvements;
  }

  /**
   * 清理模型输出，去掉多余引号与空白
   */
  private cleanOutput(text: string): string {
    return text.replace(/^["'“”\s]+|["'“”\s]+$/g, '').trim();
  }
}

/**
 * Google Gemini API 适配器
 */
export class GeminiAdapter implements APIAdapter {
  async optimize(config: ModelConfig, prompt: string): Promise<OptimizeResponse> {
    const url = `${config.endpoint}/models/${config.model}:generateContent?key=${config.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${SYSTEM_PROMPT}\n\n${USER_PROMPT_TEMPLATE(prompt)}` }],
          },
        ],
        generationConfig: {
          temperature: config.temperature ?? 0.7,
          maxOutputTokens: config.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const optimizedPrompt = this.cleanOutput(
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? prompt,
    );

    return {
      original: prompt,
      optimized: optimizedPrompt.trim(),
      improvements: ['Gemini 模型优化'],
    };
  }

  /**
   * 清理模型输出，去掉多余引号与空白
   */
  private cleanOutput(text: string): string {
    return text.replace(/^["'""\s]+|["'""\s]+$/g, '').trim();
  }

  async testConnection(config: ModelConfig): Promise<boolean> {
    try {
      const url = `${config.endpoint}/models?key=${config.apiKey}`;
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Anthropic Claude API 适配器
 */
export class ClaudeAdapter implements APIAdapter {
  async optimize(config: ModelConfig, prompt: string): Promise<OptimizeResponse> {
    const response = await fetch(`${config.endpoint}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens ?? 2048,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: USER_PROMPT_TEMPLATE(prompt) },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Claude API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const optimizedPrompt = this.cleanOutput(
      data.content?.[0]?.text ?? prompt,
    );

    return {
      original: prompt,
      optimized: optimizedPrompt.trim(),
      improvements: this.analyzeImprovements(prompt, optimizedPrompt),
    };
  }

  async testConnection(config: ModelConfig): Promise<boolean> {
    try {
      // Claude API 没有专门的 models 端点，用一个简单的消息测试
      const response = await fetch(`${config.endpoint}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey ?? '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 10,
          messages: [
            { role: 'user', content: 'Hi' },
          ],
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private analyzeImprovements(original: string, optimized: string): string[] {
    const improvements: string[] = [];
    if (optimized.length > original.length * 1.5) {
      improvements.push('补充了详细内容');
    }
    if (optimized.includes('角色') || optimized.includes('扮演')) {
      improvements.push('添加了角色设定');
    }
    if (optimized.includes('格式') || optimized.includes('输出')) {
      improvements.push('明确了输出格式');
    }
    if (improvements.length === 0) {
      improvements.push('Claude 模型优化');
    }
    return improvements;
  }

  /**
   * 清理模型输出，去掉多余引号与空白
   */
  private cleanOutput(text: string): string {
    return text.replace(/^["'""\s]+|["'""\s]+$/g, '').trim();
  }
}

/**
 * 获取适配器实例
 */
export function getAdapter(provider: ModelProvider): APIAdapter {
  switch (provider) {
    case 'gemini':
      return new GeminiAdapter();
    case 'claude':
      return new ClaudeAdapter();
    case 'openai':
    case 'grok':
    case 'openrouter':
    case 'ollama':
    case 'custom':
    default:
      return new OpenAIAdapter();
  }
}
