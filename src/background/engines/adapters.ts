/**
 * Model API Adapters
 * 各模型提供商的 API 适配器
 */

import { ModelConfig, ModelProvider, OptimizeResponse, CustomRule, PromptMethodTagId, PROMPT_METHOD_TAGS } from '@shared/types';

// 系统提示词：仅输出优化后的提示词，并具备安全与防注入约束
const SYSTEM_PROMPT_BASE = `
你是专业的 Prompt 优化助手;
请仅输出一段可直接用于大模型的优化后提示词，不要添加任何说明、示例、前后缀或引号;
`;

export function buildSystemPrompt(methodTagIds: PromptMethodTagId[], customRules: CustomRule[]): string {
  const parts: string[] = [SYSTEM_PROMPT_BASE];
  const selectedTags = PROMPT_METHOD_TAGS.filter(tag => methodTagIds.includes(tag.id));

  if (selectedTags.length > 0) {
    const tagsText = selectedTags.map(tag => `- ${tag.name}：${tag.prompt}`).join('\n');
    parts.push(`[方法论标签]\n${tagsText}`);
  }

  const enabledRules = customRules.filter(rule => rule.enabled);
  if (enabledRules.length > 0) {
    const rulesText = enabledRules.map(rule => `- ${rule.name}: ${rule.content}`).join('\n');
    parts.push(`[用户自定义优化规则]\n${rulesText}`);
  }

  return parts.join('\n\n');
}

const USER_PROMPT_TEMPLATE = (prompt: string) =>
  `在保持原意的前提下，精炼并补全以下需求，使其更清晰、可执行。仅返回优化后的提示词本身：\n\n${prompt}`;

async function logErrorResponse(prefix: string, response: Response): Promise<string> {
  const bodyText = await response.text().catch(() => '');
  console.error(`${prefix} API error: ${response.status}`, bodyText);
  return bodyText;
}

/**
 * API 适配器接口
 */
export interface APIAdapter {
  optimize(config: ModelConfig, prompt: string, systemPrompt: string): Promise<OptimizeResponse>;
  testConnection(config: ModelConfig): Promise<boolean>;
}

/**
 * OpenAI 兼容 API 适配器（OpenAI、Grok、OpenRouter、Ollama）
 */
export class OpenAIAdapter implements APIAdapter {
  async optimize(config: ModelConfig, prompt: string, systemPrompt: string): Promise<OptimizeResponse> {
    const systemContent = systemPrompt || SYSTEM_PROMPT_BASE;
    const response = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { Authorization: `Bearer ${config.apiKey}` }),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: USER_PROMPT_TEMPLATE(prompt) },
        ],
        max_tokens: config.maxTokens ?? 2048,
        temperature: config.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      await logErrorResponse('OpenAI-compatible', response);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const optimizedPrompt = this.cleanOutput(
      data.choices?.[0]?.message?.content ?? prompt,
    );

    return {
      original: prompt,
      optimized: optimizedPrompt.trim(),
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
  async optimize(config: ModelConfig, prompt: string, systemPrompt: string): Promise<OptimizeResponse> {
    const systemContent = systemPrompt || SYSTEM_PROMPT_BASE;
    const url = `${config.endpoint}/models/${config.model}:generateContent?key=${config.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${systemContent}\n\n${USER_PROMPT_TEMPLATE(prompt)}` }],
          },
        ],
        generationConfig: {
          temperature: config.temperature ?? 0.7,
          maxOutputTokens: config.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      await logErrorResponse('Gemini', response);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const optimizedPrompt = this.cleanOutput(
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? prompt,
    );

    return {
      original: prompt,
      optimized: optimizedPrompt.trim(),
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
  async optimize(config: ModelConfig, prompt: string, systemPrompt: string): Promise<OptimizeResponse> {
    const systemContent = systemPrompt || SYSTEM_PROMPT_BASE;
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
        system: systemContent,
        messages: [
          { role: 'user', content: USER_PROMPT_TEMPLATE(prompt) },
        ],
      }),
    });

    if (!response.ok) {
      const bodyText = await logErrorResponse('Claude', response);
      let errorData: { error?: { message?: string } } = {};
      try {
        errorData = JSON.parse(bodyText || '{}');
      } catch {
        errorData = {};
      }
      throw new Error(`Claude API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const optimizedPrompt = this.cleanOutput(
      data.content?.[0]?.text ?? prompt,
    );

    return {
      original: prompt,
      optimized: optimizedPrompt.trim(),
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
