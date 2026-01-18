import { CustomRule } from '@shared/types';

export async function getCustomRules(): Promise<CustomRule[]> {
  try {
    const result = await chrome.storage.local.get(['custom_rules']);
    return result.custom_rules || [];
  } catch (error) {
    console.error('Failed to load custom rules:', error);
    return [];
  }
}

export function appendCustomRulesToPrompt(originalPrompt: string, customRules: CustomRule[]): string {
  const enabledRules = customRules.filter(rule => rule.enabled);

  if (enabledRules.length === 0) {
    return originalPrompt;
  }

  const rulesText = enabledRules
    .map(rule => `- ${rule.name}: ${rule.content}`)
    .join('\n');

  return `${originalPrompt}\n\n用户自定义规则要求：\n${rulesText}\n请在遵循上述规则的基础上，处理用户的请求。`;
}

export async function enhancePromptWithCustomRules(prompt: string): Promise<string> {
  const customRules = await getCustomRules();
  return appendCustomRulesToPrompt(prompt, customRules);
}
