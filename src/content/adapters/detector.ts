/**
 * Platform Detector
 * 平台检测器
 */

import { PlatformAdapter } from '@shared/types';
import { ChatGPTAdapter } from './chatgpt';
import { ClaudeAdapter } from './claude';
import { GeminiAdapter } from './gemini';
import { GrokAdapter } from './grok';
import { QianwenAdapter } from './qianwen';
import { QwenAdapter } from './qwen';
import { YiyanAdapter } from './yiyan';
import { YuanbaoAdapter } from './yuanbao';
import { DeepSeekAdapter } from './deepseek';
import { PerplexityAdapter } from './perplexity';
import { KimiAdapter } from './kimi';

export class PlatformDetector {
  private adapters: PlatformAdapter[] = [
    new ChatGPTAdapter(),
    new ClaudeAdapter(),
    new GeminiAdapter(),
    new GrokAdapter(),
    new QianwenAdapter(),
    new QwenAdapter(),
    new YiyanAdapter(),
    new YuanbaoAdapter(),
    new DeepSeekAdapter(),
    new PerplexityAdapter(),
    new KimiAdapter(),
  ];

  /**
   * 检测当前页面平台
   */
  detect(): PlatformAdapter | null {
    const hostname = window.location.hostname;

    for (const adapter of this.adapters) {
      for (const pattern of adapter.hostPatterns) {
        if (hostname.includes(pattern)) {
          return adapter;
        }
      }
    }

    return null;
  }
}
