/**
 * Lightweight HTML-to-Markdown converter
 * Ported from ai-chat-exporter's inlined TurndownService (v7.1.2 style)
 */

type RuleFilter = string | string[] | ((node: Element) => boolean);

interface Rule {
  filter: RuleFilter;
  replacement: (content: string, node: Element) => string;
}

interface NamedRule extends Rule {
  key: string;
}

export class TurndownService {
  private rules: NamedRule[] = [];

  constructor() {
    this.addDefaultRules();
  }

  addRule(key: string, rule: Rule): void {
    this.rules.push({ ...rule, key });
  }

  /** Insert a rule at the beginning (highest priority) */
  unshiftRule(key: string, rule: Rule): void {
    this.rules.unshift({ ...rule, key });
  }

  /** Remove a rule by key */
  removeRule(key: string): void {
    this.rules = this.rules.filter((r) => r.key !== key);
  }

  turndown(rootNode: Element | DocumentFragment): string {
    const process = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.nodeValue ?? '';
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const el = node as Element;
      const tagName = el.nodeName.toLowerCase();

      // Find matching rule
      const rule = this.rules.find((r) => {
        if (typeof r.filter === 'string') {
          return r.filter === tagName;
        }
        if (Array.isArray(r.filter)) {
          return r.filter.includes(tagName);
        }
        if (typeof r.filter === 'function') {
          return r.filter(el);
        }
        return false;
      });

      const content = Array.from(el.childNodes)
        .map((n) => process(n))
        .join('');

      if (rule) {
        return rule.replacement(content, el);
      }

      return content;
    };

    let output = '';
    if (rootNode instanceof DocumentFragment || rootNode instanceof HTMLElement) {
      output = Array.from(rootNode.childNodes)
        .map((n) => process(n))
        .join('');
    } else {
      // Use outerHTML or innerHTML fallback
      output = process(rootNode);
    }

    // Clean up excessive newlines (more than two)
    return output.trim().replace(/\n{3,}/g, '\n\n');
  }

  private addDefaultRules(): void {
    // Heading (h1 - h6)
    for (let i = 1; i <= 6; i++) {
      const level = i;
      this.addRule(`heading${level}`, {
        filter: [`h${level}`],
        replacement: (content) => {
          const prefix = '#'.repeat(level);
          return `\n\n${prefix} ${content.trim()}\n\n`;
        },
      });
    }

    // Paragraph
    this.addRule('paragraph', {
      filter: ['p'],
      replacement: (content) => `\n\n${content}\n\n`,
    });

    // Line break
    this.addRule('linebreak', {
      filter: ['br'],
      replacement: () => '  \n',
    });

    // Bold
    this.addRule('bold', {
      filter: ['strong', 'b'],
      replacement: (content) => `**${content}**`,
    });

    // Italic
    this.addRule('italic', {
      filter: ['em', 'i'],
      replacement: (content) => `*${content}*`,
    });

    // Code block (pre > code)
    this.addRule('codeblock', {
      filter: (node) => node.nodeName === 'PRE' && !!node.querySelector('code'),
      replacement: (_content, node) => {
        const codeEl = node.querySelector('code');
        let code = codeEl ? codeEl.textContent ?? '' : node.textContent ?? '';

        // Try to detect language from various sources:
        // 1. <code class="language-xxx"> (standard markdown)
        // 2. <code class="hljs xxx"> (highlight.js)
        // 3. <code class="lang-xxx">
        let lang = '';
        if (codeEl) {
          const cls = codeEl.className;
          const langMatch = cls.match(/language-(\w+)/)
            || cls.match(/lang-(\w+)/)
            || cls.match(/hljs\s+(\w+)/);
          if (langMatch) {
            lang = langMatch[1];
          }
        }

        // Preserve code block inner formatting — use innerText if available
        // to better preserve line breaks from rich editors like CodeMirror
        if (codeEl && (codeEl as HTMLElement).innerText) {
          const innerText = (codeEl as HTMLElement).innerText;
          if (innerText.trim().length > code.trim().length * 0.8) {
            code = innerText;
          }
        }

        return `\n\n\`\`\`${lang}\n${code.replace(/\n$/, '')}\n\`\`\`\n\n`;
      },
    });

    // Inline code
    this.addRule('code', {
      filter: ['code'],
      replacement: (content) => {
        // Skip if inside pre (handled by codeblock rule)
        return `\`${content}\``;
      },
    });

    // Horizontal rule
    this.addRule('hr', {
      filter: ['hr'],
      replacement: () => '\n\n___\n\n',
    });

    // Unordered list
    this.addRule('list', {
      filter: ['ul', 'ol'],
      replacement: (content, node) => {
        const isOrdered = node.nodeName === 'OL';
        const items = content.trim().split('\n');
        const processed = items
          .filter((item) => item.trim())
          .map((item, idx) => {
            const prefix = isOrdered ? `${idx + 1}.` : '-';
            // Indent nested content
            const lines = item.split('\n').map((line, li) => (li > 0 ? `  ${line}` : line));
            lines[0] = `${prefix} ${lines[0]}`;
            return lines.join('\n');
          })
          .join('\n');
        return `\n\n${processed}\n\n`;
      },
    });

    // List item
    this.addRule('listitem', {
      filter: ['li'],
      replacement: (content) => content.trim(),
    });

    // Blockquote
    this.addRule('blockquote', {
      filter: ['blockquote'],
      replacement: (content) => {
        const lines = content.trim().split('\n');
        const quoted = lines.map((line) => (line ? `> ${line}` : '>')).join('\n');
        return `\n\n${quoted}\n\n`;
      },
    });

    // Anchor
    this.addRule('link', {
      filter: ['a'],
      replacement: (content, node) => {
        const href = (node as HTMLAnchorElement).getAttribute('href') ?? '';
        if (!href) {
          return content;
        }
        const title = (node as HTMLAnchorElement).getAttribute('title');
        const titlePart = title ? ` "${title}"` : '';
        return `[${content}](${href}${titlePart})`;
      },
    });

    // Image
    this.addRule('image', {
      filter: ['img'],
      replacement: (_content, node) => {
        const src = (node as HTMLImageElement).getAttribute('src') ?? '';
        const alt = (node as HTMLImageElement).alt ?? '';
        return src ? `![${alt}](${src})` : '';
      },
    });

    // Table
    this.addRule('table', {
      filter: ['table'],
      replacement: (content) => `\n\n${content}\n\n`,
    });

    // Table row
    this.addRule('tr', {
      filter: ['tr'],
      replacement: (content) => `|${content}|\n`,
    });

    // Table cell (th, td)
    this.addRule('th', {
      filter: ['th'],
      replacement: (content) => ` ${content} |`,
    });

    this.addRule('td', {
      filter: ['td'],
      replacement: (content) => ` ${content} |`,
    });

    // Subscript / Superscript (passthrough as HTML)
    this.addRule('sub', {
      filter: ['sub'],
      replacement: (content) => (content.trim() ? `<sub>${content}</sub>` : ''),
    });

    this.addRule('sup', {
      filter: ['sup'],
      replacement: (content) => (content.trim() ? `<sup>${content}</sup>` : ''),
    });

    // Div / Span (pass through content)
    this.addRule('div', {
      filter: ['div'],
      replacement: (content) => (content ? `${content}\n\n` : ''),
    });

    this.addRule('span', {
      filter: ['span'],
      replacement: (content) => content,
    });

    // Break (convert to newline)
    this.addRule('break', {
      filter: (node) => node.nodeName === 'BR',
      replacement: () => '\n',
    });
  }
}
