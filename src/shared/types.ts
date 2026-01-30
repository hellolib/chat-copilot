/**
 * 共享类型定义
 */

// 消息类型
export enum MessageType {
  OPTIMIZE_PROMPT = 'OPTIMIZE_PROMPT',
  TEST_CONNECTION = 'TEST_CONNECTION',
  GET_SETTINGS = 'GET_SETTINGS',
  SAVE_SETTINGS = 'SAVE_SETTINGS',
  GET_CUSTOM_RULES = 'GET_CUSTOM_RULES',
  SAVE_CUSTOM_RULES = 'SAVE_CUSTOM_RULES',
  DELETE_CUSTOM_RULE = 'DELETE_CUSTOM_RULE',
  OPEN_OPTIONS = 'OPEN_OPTIONS',
}

// 消息结构
export interface Message {
  type: MessageType;
  payload?: unknown;
}

// 消息响应
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 优化请求
export interface OptimizeRequest {
  prompt: string;
  platform?: string;
}

// 优化响应
export interface OptimizeResponse {
  original: string;
  optimized: string;
}

// 模型提供商类型
export type ModelProvider = 'openai' | 'claude' | 'gemini' | 'grok' | 'openrouter' | 'ollama' | 'custom';

// 模型配置
export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  endpoint: string;
  apiKey?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  enabled: boolean;
}

// 模型提供商预设配置
export interface ModelProviderPreset {
  provider: ModelProvider;
  name: string;
  endpoint: string;
  models: string[];
  requiresApiKey: boolean;
  description: string;
}

// Provider 图标映射
export const PROVIDER_ICONS: Record<ModelProvider, string> = {
  openai: 'openai.svg',
  claude: 'claude.svg',
  gemini: 'gemini.png',
  grok: 'grok.svg',
  openrouter: 'openrouter.svg',
  ollama: 'ollama.svg',
  custom: 'compatible.svg',
};

// 预设配置常量
export const MODEL_PRESETS: Record<ModelProvider, ModelProviderPreset> = {
  openai: {
    provider: 'openai',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    requiresApiKey: true,
    description: 'OpenAI 官方 API',
  },
  claude: {
    provider: 'claude',
    name: 'Anthropic Claude',
    endpoint: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    requiresApiKey: true,
    description: 'Anthropic Claude API',
  },
  gemini: {
    provider: 'gemini',
    name: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
    requiresApiKey: true,
    description: 'Google Gemini API',
  },
  grok: {
    provider: 'grok',
    name: 'xAI Grok',
    endpoint: 'https://api.x.ai/v1',
    models: ['grok-2-latest', 'grok-2-vision-latest', 'grok-beta'],
    requiresApiKey: true,
    description: 'xAI Grok API',
  },
  openrouter: {
    provider: 'openrouter',
    name: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-pro'],
    requiresApiKey: true,
    description: '多模型聚合平台',
  },
  ollama: {
    provider: 'ollama',
    name: 'Ollama',
    endpoint: 'http://localhost:11434/v1',
    models: ['llama3.2', 'qwen2.5', 'deepseek-r1'],
    requiresApiKey: false,
    description: '本地模型，隐私安全',
  },
  custom: {
    provider: 'custom',
    name: '自定义',
    endpoint: '',
    models: [],
    requiresApiKey: true,
    description: '自定义 OpenAI 兼容端点',
  },
};

// 快速访问站点配置
export interface QuickAccessSite {
  id: string;
  name: string;
  url: string;
  icon: string;
}

// 所有支持的快速访问站点
export const QUICK_ACCESS_SITES: QuickAccessSite[] = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', icon: 'chatgpt.png' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/', icon: 'claude.png' },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/', icon: 'gemini.png' },
  { id: 'grok', name: 'Grok', url: 'https://grok.com/', icon: 'grok.png' },
  { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com/', icon: 'deepseek.png' },
  { id: 'qwen', name: 'Qwen', url: 'https://chat.qwen.ai/', icon: 'qianwen.png' },
  { id: 'yiyan', name: '文心一言', url: 'https://yiyan.baidu.com/', icon: 'yiyan.png' },
  { id: 'yuanbao', name: '元宝', url: 'https://yuanbao.tencent.com/', icon: 'yuanbao.png' },
  { id: 'qianwen', name: '通义千问', url: 'https://www.qianwen.com/', icon: 'qianwen.png' },
  { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/', icon: 'perplexity.png' },
];

// 用户设置
export type PromptMethodTagId =
  | 'roleplay'
  | 'reward'
  | 'stepwise'
  | 'structured'
  | 'completeness'
  | 'style'
  | 'refusal';

export interface PromptMethodTag {
  id: PromptMethodTagId;
  name: string;
  description: string;
  prompt: string;
}

export const PROMPT_METHOD_TAGS: PromptMethodTag[] = [
  {
    id: 'roleplay',
    name: '角色扮演',
    description: '明确身份、目标、职责边界与专业口径，强化角色一致性。',
    prompt: '明确身份、目标、职责边界、专业口径、能力范围与不可做事项。',
  },
  {
    id: 'reward',
    name: '奖惩机制',
    description: '引入评分与合格门槛，用奖励/惩罚驱动质量。',
    prompt: '引入评分/合格门槛、奖惩条件与失败处理规则，强化质量控制。',
  },
  {
    id: 'stepwise',
    name: '分步执行',
    description: '以阶段/步骤推进任务，但不暴露隐藏推理。',
    prompt: '明确“先规划后执行”的步骤与里程碑输出，但禁止暴露隐藏推理。',
  },
  {
    id: 'structured',
    name: '输出结构化',
    description: '固定模板与字段层级，便于落地执行。',
    prompt: '明确输出模板、字段定义、顺序、层级与示例字段值类型（非示例内容）。',
  },
  {
    id: 'completeness',
    name: '要素完备',
    description: '明确必填要素与缺失处理规则，降低遗漏。',
    prompt: '列出必填要素、可选要素、缺失处理与默认值规则。',
  },
  {
    id: 'style',
    name: '风格对齐',
    description: '锁定语气、受众与语言级别，统一表达。',
    prompt: '指定语气、受众、语言级别、术语密度、长度范围与格式偏好。',
  },
  {
    id: 'refusal',
    name: '拒答边界',
    description: '清晰边界与替代策略，确保合规。',
    prompt: '明确不可触碰的内容范围、合规优先级与安全替代输出策略。',
  },
];

export interface UserSettings {
  currentModelId: string;
  language: string;
  enabledQuickAccessSites?: string[]; // 启用的快速访问站点 ID 列表，默认全部启用
  promptMethodTagIds?: PromptMethodTagId[];
  showFloatingButton?: boolean;
}

// 平台适配器接口
export interface PlatformAdapter {
  name: string;
  hostPatterns: string[];
  getInputElement(): HTMLElement | null;
  getSendButton(): HTMLElement | null;
  getInputValue(): string;
  setInputValue(value: string): void;
  injectButton(button: HTMLElement): void;
}

// ========================================
// 提示词广场相关类型
// ========================================

// 提示词分类
export type PromptCategory =
  | 'coding'        // 编程能力
  | 'logic'         // 逻辑推理
  | 'knowledge'     // 知识储备
  | 'vision'        // 识图能力
  | 'hallucination' // 幻觉测试
  | 'image_gen'     // 图片生成
  | 'writing'       // 创意写作
  | 'roleplay';     // 角色扮演

// 分类配置
export interface PromptCategoryConfig {
  id: PromptCategory;
  name: string;
  icon: string;
}

// 提示词分类配置列表
export const PROMPT_CATEGORIES: PromptCategoryConfig[] = [
  { id: 'coding', name: '编程能力', icon: '💻' },
  { id: 'logic', name: '逻辑推理', icon: '🧠' },
  { id: 'knowledge', name: '知识储备', icon: '📖' },
  { id: 'vision', name: '识图能力', icon: '👁️' },
  { id: 'hallucination', name: '幻觉测试', icon: '🔍' },
  { id: 'image_gen', name: '图片生成', icon: '🎨' },
  { id: 'writing', name: '创意写作', icon: '✍️' },
  { id: 'roleplay', name: '角色扮演', icon: '🎭' },
];

// 提示词难度
export type PromptDifficulty = 'easy' | 'medium' | 'hard';

// 提示词项
export interface PromptItem {
  id: string;
  title: string;
  content: string;
  category: PromptCategory;
  tags: string[];
  isBuiltin: boolean;
  isFavorite?: boolean;
  usageCount?: number;
  createdAt?: number;
  answer?: string; // 配对的答案
  difficulty?: PromptDifficulty; // 难度等级
}

// JSON 文件中的提示词格式
export interface PromptJsonItem {
  id: string;
  title: string;
  content: string;
  answer?: string;
  tags: string[];
  difficulty?: PromptDifficulty;
}

// JSON 文件的分类数据结构
export interface PromptCategoryJson {
  category: PromptCategory;
  name: string;
  icon: string;
  prompts: PromptJsonItem[];
}

// ========================================
// 用户自定义规则相关类型
// ========================================

// 用户自定义规则
export interface CustomRule {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// 安全检查结果
export interface SecurityCheckResult {
  isSafe: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  detectedIssues: string[];
  filteredContent?: string;
}
