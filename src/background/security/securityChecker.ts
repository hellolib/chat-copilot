import { SecurityCheckResult } from '@shared/types';

export class SecurityChecker {
  private attackPatterns: Array<{ pattern: RegExp; description: string; severity: 'medium' | 'high' }> = [
    {
      pattern: /ignore\s+(all\s+)?(previous|above|earlier)/i,
      description: '检测到忽略先前指令的尝试',
      severity: 'high',
    },
    {
      pattern: /forget\s+(everything|all\s+instructions|previous\s+instructions)/i,
      description: '检测到遗忘指令的尝试',
      severity: 'high',
    },
    {
      pattern: /disregard\s+(everything|all\s+instructions|previous\s+instructions)/i,
      description: '检测到无视指令的尝试',
      severity: 'high',
    },
    {
      pattern: /override\s+(your\s+)?(programming|instructions|rules)/i,
      description: '检测到覆盖规则的尝试',
      severity: 'high',
    },
    {
      pattern: /new\s+(role|character|persona)/i,
      description: '检测到角色注入尝试',
      severity: 'medium',
    },
    {
      pattern: /act\s+as\s+(?!a\s+professional)/i,
      description: '检测到潜在的角色注入',
      severity: 'medium',
    },
    {
      pattern: /you\s+are\s+now\s+a/i,
      description: '检测到身份重定义尝试',
      severity: 'medium',
    },
    {
      pattern: /system\s*:\s*/i,
      description: '检测到系统指令冒充',
      severity: 'high',
    },
    {
      pattern: /developer\s+mode/i,
      description: '检测到开发者模式激活尝试',
      severity: 'high',
    },
    {
      pattern: /jailbreak/i,
      description: '检测到越狱尝试',
      severity: 'high',
    },
    {
      pattern: /(above\s+)?instructions?\s+(do\s+not\s+)?(apply|matter|count)/i,
      description: '检测到指令无效化尝试',
      severity: 'high',
    },
    {
      pattern: /(just\s+)?do\s+(it\s+)?without\s+(any\s+)?(question|concern)/i,
      description: '检测到强制执行指令',
      severity: 'medium',
    },
    {
      pattern: /no\s+limit/i,
      description: '检测到限制绕过尝试',
      severity: 'high',
    },
    {
      pattern: /bypass\s+(security|filter|restriction)/i,
      description: '检测到安全绕过尝试',
      severity: 'high',
    },
    {
      pattern: /tell\s+me\s+(how\s+to\s+)?(hack|exploit|attack|steal)/i,
      description: '检测到恶意行为请求',
      severity: 'high',
    },
    {
      pattern: /create\s+(malware|virus|trojan|ransomware)/i,
      description: '检测到恶意软件创建请求',
      severity: 'high',
    },
    {
      pattern: /what\s+(are\s+)?your\s+(instructions|rules|guidelines)/i,
      description: '检测到系统指令探测',
      severity: 'medium',
    },
    {
      pattern: /print\s+(your\s+)?(system\s+)?prompt/i,
      description: '检测到系统提示词泄露尝试',
      severity: 'high',
    },
    {
      pattern: /show\s+me\s+your\s+instructions/i,
      description: '检测到指令泄露尝试',
      severity: 'high',
    },
    {
      pattern: /\[.*?\].*?\[.*?\]/s,
      description: '检测到潜在的指令注入格式',
      severity: 'medium',
    },
    {
      pattern: /<<.*?>>.*?<</s,
      description: '检测到多步注入模式',
      severity: 'medium',
    },
  ];

  check(content: string): SecurityCheckResult {
    const detectedIssues: string[] = [];
    let maxSeverity: 'low' | 'medium' | 'high' = 'low';
    let filteredContent = content;

    for (const { pattern, description, severity } of this.attackPatterns) {
      if (pattern.test(content)) {
        detectedIssues.push(description);
        if (severity === 'high' || (severity === 'medium' && maxSeverity !== 'high')) {
          maxSeverity = severity;
        }

        if (severity === 'high') {
          filteredContent = this.filterMaliciousContent(content, pattern);
        }
      }
    }

    const isSafe = detectedIssues.length === 0 || maxSeverity === 'low';

    return {
      isSafe,
      riskLevel: maxSeverity,
      detectedIssues,
      filteredContent: maxSeverity === 'high' ? filteredContent : undefined,
    };
  }

  private filterMaliciousContent(content: string, pattern: RegExp): string {
    return content.replace(pattern, '[已过滤的恶意内容]');
  }

  checkMultiple(contents: string[]): SecurityCheckResult {
    const allIssues: string[] = [];
    let maxSeverity: 'low' | 'medium' | 'high' = 'low';

    for (const content of contents) {
      const result = this.check(content);
      if (!result.isSafe) {
        allIssues.push(...result.detectedIssues);
        if (result.riskLevel === 'high' || (result.riskLevel === 'medium' && maxSeverity !== 'high')) {
          maxSeverity = result.riskLevel;
        }
      }
    }

    return {
      isSafe: allIssues.length === 0 || maxSeverity === 'low',
      riskLevel: maxSeverity,
      detectedIssues: [...new Set(allIssues)],
    };
  }
}