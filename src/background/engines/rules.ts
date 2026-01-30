/**
 * Rules Engine
 * 内置优化引擎，系统内置
 * 支持可配置规则、优先级和组合机制
 */

import { OptimizeResponse } from '@shared/types';

/**
 * 优化规则接口
 */
interface OptimizationRule {
  id: string;
  name: string;
  priority: number; // 优先级，数字越大优先级越高
  check: (text: string, context?: RuleContext) => boolean;
  apply: (text: string, context: RuleContext) => string;
  description: string;
}

/**
 * 规则上下文
 */
interface RuleContext {
  inferredRole?: string;
  detectedLanguage?: 'zh' | 'en';
  promptLength?: number;
  hasCodeBlock?: boolean;
}

export class RulesEngine {
  private rules: OptimizationRule[] = [];
  private enabledRuleIds: Set<string> = new Set();

  constructor() {
    this.initializeDefaultRules();
    // 默认启用所有规则
    this.rules.forEach(rule => this.enabledRuleIds.add(rule.id));
  }

  /**
   * 初始化默认规则
   */
  private initializeDefaultRules(): void {
    this.rules = [
      {
        id: 'role-definition',
        name: '角色设定',
        priority: 100,
        check: (text) => !this.hasRoleDefinition(text),
        apply: (text, context) => {
          const role = context.inferredRole || '专业助手';
          return `请扮演${role}的角色。\n\n${text}`;
        },
        description: '为 Prompt 添加明确的角色设定',
      },
      {
        id: 'structure-requirements',
        name: '结构化要求',
        priority: 80,
        check: (text) => !this.hasStructure(text),
        apply: (text, _context) => {
          return `${text}\n\n请按以下要求完成：\n1. 内容准确、专业\n2. 逻辑清晰、条理分明\n3. 语言简洁、易于理解`;
        },
        description: '添加结构化输出要求',
      },
      {
        id: 'output-format',
        name: '输出格式',
        priority: 70,
        check: (text) => !this.hasOutputFormat(text),
        apply: (text, _context) => {
          return `${text}\n\n输出格式要求：结构化呈现，重点突出。`;
        },
        description: '明确输出格式要求',
      },
      {
        id: 'context-enhancement',
        name: '上下文增强',
        priority: 60,
        check: (text) => text.length < 50 && !this.hasDetailedContext(text),
        apply: (text, _context) => {
          return `${text}\n\n请提供详细和全面的信息。`;
        },
        description: '为简短的 Prompt 添加上下文增强',
      },
      {
        id: 'code-specific',
        name: '代码优化',
        priority: 90,
        check: (text, context) => context?.hasCodeBlock === true && !this.hasCodeRequirements(text),
        apply: (text, _context) => {
          return `${text}\n\n代码要求：\n- 遵循最佳实践和设计模式\n- 包含必要的注释\n- 确保代码质量和可读性`;
        },
        description: '为代码相关的 Prompt 添加特定要求',
      },
    ];

    // 按优先级排序
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 优化 Prompt
   */
  optimize(prompt: string): OptimizeResponse {
    let optimized = prompt.trim();

    // 构建上下文
    const context = this.buildContext(optimized);

    // 按优先级应用规则
    for (const rule of this.rules) {
      // 跳过未启用的规则
      if (!this.enabledRuleIds.has(rule.id)) {
        continue;
      }

      // 检查规则是否适用
      if (rule.check(optimized, context)) {
        optimized = rule.apply(optimized, context);
      }
    }

    return {
      original: prompt,
      optimized,
    };
  }

  /**
   * 构建规则上下文
   */
  private buildContext(text: string): RuleContext {
    return {
      inferredRole: this.inferRole(text),
      detectedLanguage: this.detectLanguage(text),
      promptLength: text.length,
      hasCodeBlock: this.hasCodeBlock(text),
    };
  }

  /**
   * 检测语言
   */
  private detectLanguage(text: string): 'zh' | 'en' {
    // 简单的中文检测：检查是否包含中文字符
    const chineseRegex = /[\u4e00-\u9fa5]/;
    return chineseRegex.test(text) ? 'zh' : 'en';
  }

  /**
   * 检查是否包含代码块
   */
  private hasCodeBlock(text: string): boolean {
    const codeKeywords = ['代码', '程序', 'code', 'function', 'class', '```', 'script'];
    return codeKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * 检查是否有角色定义
   */
  private hasRoleDefinition(text: string): boolean {
    const roleKeywords = ['扮演', '作为', '你是', 'Act as', 'You are', 'Role:', 'As a'];
    return roleKeywords.some((keyword) => text.includes(keyword));
  }

  /**
   * 检查是否有结构化要求
   */
  private hasStructure(text: string): boolean {
    const structurePatterns = [/\d+\.\s/, /[-•]\s/, /要求[:：]/, /步骤[:：]/, /requirements:/i, /steps:/i];
    return structurePatterns.some((pattern) => pattern.test(text));
  }

  /**
   * 检查是否有输出格式要求
   */
  private hasOutputFormat(text: string): boolean {
    const formatKeywords = ['格式', '输出', '字数', 'format', 'output', 'style'];
    return formatKeywords.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * 检查是否有详细上下文
   */
  private hasDetailedContext(text: string): boolean {
    const contextKeywords = ['详细', '具体', '全面', 'detailed', 'specific', 'comprehensive'];
    return contextKeywords.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * 检查是否有代码要求
   */
  private hasCodeRequirements(text: string): boolean {
    const codeReqKeywords = ['注释', '最佳实践', 'comments', 'best practice', 'clean code'];
    return codeReqKeywords.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * 推断角色 - 改进的多关键词匹配
   */
  private inferRole(text: string): string {
    const lowerText = text.toLowerCase();

    // 角色映射表，支持多个关键词和权重
    const roleMap: Array<{ keywords: string[]; role: string; weight: number }> = [
      { keywords: ['代码', '程序', 'code', 'programming', 'develop', 'bug', 'debug'], role: '资深软件工程师', weight: 10 },
      { keywords: ['前端', 'frontend', 'react', 'vue', 'angular', 'css', 'html'], role: '前端开发专家', weight: 9 },
      { keywords: ['后端', 'backend', 'api', 'database', 'server'], role: '后端开发专家', weight: 9 },
      { keywords: ['文章', '写作', 'article', 'writing', 'blog'], role: '专业内容创作者', weight: 8 },
      { keywords: ['文案', '营销', 'copywriting', 'marketing', '广告'], role: '资深文案策划', weight: 8 },
      { keywords: ['产品', 'product', 'prd', '需求'], role: '资深产品经理', weight: 7 },
      { keywords: ['设计', 'design', 'ui', 'ux', '界面'], role: '专业设计师', weight: 7 },
      { keywords: ['翻译', 'translate', 'translation'], role: '专业翻译', weight: 9 },
      { keywords: ['分析', 'analysis', 'data', '数据'], role: '数据分析师', weight: 7 },
      { keywords: ['测试', 'test', 'qa', 'quality'], role: '测试工程师', weight: 6 },
      { keywords: ['架构', 'architecture', '系统设计'], role: '系统架构师', weight: 8 },
    ];

    // 计算每个角色的匹配分数
    let maxScore = 0;
    let bestRole = '专业助手';

    for (const { keywords, role, weight } of roleMap) {
      let score = 0;
      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          score += weight;
        }
      }

      if (score > maxScore) {
        maxScore = score;
        bestRole = role;
      }
    }

    return bestRole;
  }

  /**
   * 启用规则
   */
  enableRule(ruleId: string): void {
    this.enabledRuleIds.add(ruleId);
  }

  /**
   * 禁用规则
   */
  disableRule(ruleId: string): void {
    this.enabledRuleIds.delete(ruleId);
  }

  /**
   * 添加自定义规则
   */
  addCustomRule(rule: OptimizationRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
    this.enabledRuleIds.add(rule.id);
  }

  /**
   * 获取所有规则
   */
  getRules(): OptimizationRule[] {
    return [...this.rules];
  }

  /**
   * 获取启用的规则
   */
  getEnabledRules(): OptimizationRule[] {
    return this.rules.filter(rule => this.enabledRuleIds.has(rule.id));
  }
}
