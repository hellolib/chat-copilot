/**
 * Knowledge Extractor
 * 对话知识提炼引擎 - 复用现有的 ModelManager 调用 AI 模型提炼知识
 */

import { ConversationMessage, KnowledgeResult } from '@shared/types';
import { AppError, ErrorCode, ErrorHandler } from '@shared/errors';

/**
 * 知识提炼的 System Prompt
 * 指导 AI 模型从多轮对话中提取可沉淀的知识
 */
const KNOWLEDGE_EXTRACTION_PROMPT = `你是一个专业的知识提炼助手。请从以下多轮对话中提取有价值的知识，并以 JSON 格式返回结果。

要求：
1. 只提取可以沉淀和后续学习的知识性内容（概念、原理、方法、最佳实践、代码片段等）
2. 过滤掉闲聊、问候、寒暄等无知识价值的内容
3. 确保提炼的知识准确反映对话中的信息，不要编造
4. 用中文输出

请严格按照以下 JSON 格式返回（不要添加任何额外说明或标记）：
{
  "title": "知识的标题（简短概括）",
  "summary": "一句话总结这段知识的核心内容",
  "keyPoints": ["要点1", "要点2", "要点3（最多5个要点）"],
  "details": "详细内容，包含所有重要的背景信息、原理说明、步骤等，支持 Markdown 格式",
  "tags": ["标签1", "标签2", "标签3（最多5个标签）"]
}`;

/**
 * 从多轮对话中提炼知识
 * @param messages 对话消息列表
 * @param apiCallFn 调用 AI 模型的函数，复用现有模型配置
 */
export async function extractKnowledge(
  messages: ConversationMessage[],
  apiCallFn: (systemPrompt: string, userContent: string) => Promise<string>,
): Promise<KnowledgeResult> {
  if (!messages || messages.length === 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, '没有可提取的对话内容');
  }

  try {
    // 构建对话文本
    const conversationText = messages
      .map(msg => {
        const role = msg.role === 'user' ? '用户' : 'AI';
        return `[${role}]\n${msg.content}`;
      })
      .join('\n\n');

    const userContent = `请从以下对话中提炼知识：\n\n${conversationText}`;

    // 调用 AI 模型
    const response = await apiCallFn(KNOWLEDGE_EXTRACTION_PROMPT, userContent);

    // 解析 JSON 响应（处理 AI 可能返回的代码块包裹）
    const jsonStr = extractJsonFromResponse(response);
    const result = JSON.parse(jsonStr) as Omit<KnowledgeResult, 'sourceUrl' | 'sourcePlatform' | 'createdAt'>;

    // 验证必填字段
    if (!result.title || !result.summary || !result.details) {
      throw new AppError(ErrorCode.API_ERROR, 'AI 返回的知识格式不完整');
    }

    return {
      title: result.title,
      summary: result.summary,
      keyPoints: result.keyPoints ?? [],
      details: result.details,
      tags: result.tags ?? [],
      sourceUrl: '',
      sourcePlatform: '',
      createdAt: Date.now(),
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    ErrorHandler.logError(error, 'extractKnowledge');
    throw new AppError(ErrorCode.API_ERROR, '知识提炼失败', error);
  }
}

/**
 * 从 AI 响应中提取 JSON 字符串
 * 处理 AI 可能用代码块包裹 JSON 的情况
 */
function extractJsonFromResponse(response: string): string {
  // 尝试匹配 ```json ... ``` 代码块
  const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // 尝试匹配最外层的 { } JSON 对象
  const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    return jsonObjectMatch[0].trim();
  }

  // 直接返回原文本
  return response.trim();
}
