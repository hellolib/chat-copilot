/**
 * 提示词数据加载器
 * 从 JSON 配置文件加载提示词数据
 */

import { PromptItem, PromptCategory, PromptCategoryJson } from './types';

// 分类文件列表
const CATEGORY_FILES: PromptCategory[] = [
  'logic',
  'knowledge',
  'vision',
  'coding',
  'hallucination',
  'image_gen',
  'writing',
  'roleplay',
];

// 缓存加载的提示词
let cachedPrompts: PromptItem[] | null = null;

/**
 * 从 JSON 文件加载单个分类的提示词
 */
async function loadCategoryPrompts(category: PromptCategory): Promise<PromptItem[]> {
  try {
    const url = chrome.runtime.getURL(`data/prompts/${category}.json`);
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to load prompts for category: ${category}`);
      return [];
    }
    const data: PromptCategoryJson = await response.json();

    // 转换为 PromptItem 格式
    return data.prompts.map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      category: data.category,
      tags: item.tags,
      isBuiltin: true,
      answer: item.answer,
      difficulty: item.difficulty,
    }));
  } catch (error) {
    console.error(`Error loading prompts for category ${category}:`, error);
    return [];
  }
}

/**
 * 加载所有内置提示词
 */
export async function loadBuiltinPrompts(): Promise<PromptItem[]> {
  // 如果已缓存，直接返回
  if (cachedPrompts) {
    return cachedPrompts;
  }

  try {
    // 并行加载所有分类
    const results = await Promise.all(
      CATEGORY_FILES.map(category => loadCategoryPrompts(category))
    );

    // 合并所有提示词
    cachedPrompts = results.flat();
    return cachedPrompts;
  } catch (error) {
    console.error('Error loading builtin prompts:', error);
    return [];
  }
}

/**
 * 清除缓存（用于重新加载）
 */
export function clearPromptsCache(): void {
  cachedPrompts = null;
}

/**
 * 获取指定分类的提示词
 */
export async function getPromptsByCategory(category: PromptCategory): Promise<PromptItem[]> {
  const allPrompts = await loadBuiltinPrompts();
  return allPrompts.filter(p => p.category === category);
}

/**
 * 根据 ID 获取单个提示词
 */
export async function getPromptById(id: string): Promise<PromptItem | undefined> {
  const allPrompts = await loadBuiltinPrompts();
  return allPrompts.find(p => p.id === id);
}

/**
 * 搜索提示词
 */
export async function searchPrompts(query: string): Promise<PromptItem[]> {
  const allPrompts = await loadBuiltinPrompts();
  const lowerQuery = query.toLowerCase();

  return allPrompts.filter(p =>
    p.title.toLowerCase().includes(lowerQuery) ||
    p.content.toLowerCase().includes(lowerQuery) ||
    p.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

// 为了向后兼容，保留同步导出（但数据为空，需要异步加载）
export const BUILTIN_PROMPTS: PromptItem[] = [];
