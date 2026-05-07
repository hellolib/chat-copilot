/**
 * ChatGPT Adapter
 * 完整实现 ChatGPT 平台的适配
 */

import { BaseAdapter } from './base';
import { ConversationMessage } from '@shared/types';

export class ChatGPTAdapter extends BaseAdapter {
  name = 'ChatGPT';
  hostPatterns = ['chatgpt.com', 'chat.openai.com'];

  private inputSelector = '#prompt-textarea';
  private sendButtonSelector = 'button[data-testid="send-button"]';
  private formSelector = 'form';

  /** ChatGPT DOM 选择器配置（便于页面改版时快速调整） */
  private selectors = {
    /** ChatGPT 每条对话的容器 */
    conversationTurn: 'section[data-testid^="conversation-turn-"]',
    /** 旧版 DOM：article 元素 */
    article: 'article[data-message-author-role="user"], article[data-message-author-role="assistant"]',
    /** 纯文本/渲染后的 Markdown 内容容器 */
    textContent: '.markdown, .whitespace-pre-wrap',
    /** 角色标识 header */
    header: 'h4',
  };

  /**
   * 获取当前对话标题
   */
  getChatTitle(): string {
    return document.title.replace(/ - ChatGPT$/, '').trim() || 'chat';
  }

  /**
   * 获取输入框元素
   */
  getInputElement(): HTMLElement | null {
    return document.querySelector(this.inputSelector);
  }

  /**
   * 获取发送按钮
   */
  getSendButton(): HTMLElement | null {
    return document.querySelector(this.sendButtonSelector);
  }

  /**
   * 获取输入框的值
   */
  getInputValue(): string {
    const input = this.getInputElement();
    if (!input) {return '';}

    // ChatGPT 使用 contenteditable 的 div
    return input.textContent?.trim() ?? '';
  }

  /**
   * 设置输入框的值
   */
  setInputValue(value: string): void {
    const input = this.getInputElement();
    if (!input) {return;}

    // 清空现有内容
    input.innerHTML = '';

    // 创建段落元素
    const p = document.createElement('p');
    p.textContent = value;
    input.appendChild(p);

    // 触发 input 事件，让 ChatGPT 检测到内容变化
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // 聚焦输入框
    input.focus();

    // 将光标移到末尾
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  /**
   * 查找按钮容器 - 使用多种策略
   */
  findButtonContainer(): HTMLElement | null {
    return this.findElementWithStrategies([
      // 策略1: 通过class名查找
      () => document.querySelector('.ms-auto.flex.items-center[class*="gap"]') as HTMLElement,

      // 策略2: 通过发送按钮查找其兄弟容器
      () => {
        const sendBtn = this.getSendButton();
        if (sendBtn) {
          // 查找发送按钮的父容器中的工具栏容器
          const form = sendBtn.closest('form');
          if (form) {
            return form.querySelector('.ms-auto.flex.items-center') as HTMLElement;
          }
        }
        return null;
      },

      // 策略3: 通过输入框查找相邻的按钮容器
      () => {
        const input = this.getInputElement();
        if (input) {
          const form = input.closest('form');
          if (form) {
            // 查找包含多个按钮的flex容器
            const containers = form.querySelectorAll('div.flex.items-center');
            for (const container of containers) {
              // 检查容器是否包含按钮
              if (container.querySelector('button') && container.children.length > 1) {
                return container as HTMLElement;
              }
            }
          }
        }
        return null;
      },
    ]);
  }

  /**
   * 自定义按钮样式（覆盖基类）
   */
  protected styleButton(button: HTMLElement): void {
    super.styleButton(button);
    // ChatGPT 特定的样式调整
    button.style.height = '32px';
    button.style.borderRadius = '16px';
  }

  /**
   * 提取 ChatGPT 对话历史
   *
   * ChatGPT 最新 DOM 结构特点:
   * - 每条消息是一个 <section data-testid="conversation-turn-X"> 容器
   * - 通过 data-turn 属性区分角色: "user" 或 "assistant"
   * - 消息文本在 section 内部的 .markdown 或 .whitespace-pre-wrap 中
   *
   * 参考 ai-chat-exporter 的 DOM 选择器策略
   */
  getConversationHistory(): ConversationMessage[] {
    const messages: ConversationMessage[] = [];

    try {
      const sections = document.querySelectorAll<HTMLElement>(
        this.selectors.conversationTurn,
      );

      if (sections.length === 0) {
        // Fallback: try article[data-message-author-role] for older DOM
        return this.fallbackGetConversationHistory();
      }

      sections.forEach((section) => {
        const turnType = section.getAttribute('data-turn');
        const header =
          section.querySelector(this.selectors.header)?.textContent?.trim().toLowerCase() || '';

        const isUser =
          turnType === 'user' || header.includes('you said');
        const role = isUser ? 'user' as const : 'assistant' as const;

        // Extract content from the .markdown or .whitespace-pre-wrap container
        const contentTarget = section.querySelector<HTMLElement>(
          this.selectors.textContent,
        );
        if (!contentTarget) {
          // Fallback to entire section text
          const text = this.extractElementText(section);
          if (text) {
            messages.push({ role, content: text });
          }
          return;
        }

        const text = contentTarget.textContent?.trim();
        if (text && text.length > 1) {
          messages.push({ role, content: text });
        } else {
          // Fallback
          const text = this.extractElementText(section);
          if (text) {
            messages.push({ role, content: text });
          }
        }
      });
    } catch (error) {
      console.warn(`[Chat Copilot - ${this.name}] 提取对话历史失败:`, error);
    }

    return messages;
  }

  /**
   * Fallback: 使用旧的 article[data-message-author-role] 选择器
   */
  private fallbackGetConversationHistory(): ConversationMessage[] {
    const messages: ConversationMessage[] = [];

    try {
      const articles = document.querySelectorAll<HTMLElement>(
        this.selectors.article,
      );
      articles.forEach((article) => {
        const role = article.getAttribute('data-message-author-role');
        if (role !== 'user' && role !== 'assistant') { return; }
        const text = this.extractChatGPTMessageText(article);
        if (text) {
          messages.push({ role, content: text });
        }
      });
    } catch (error) {
      console.warn(`[Chat Copilot - ${this.name}] fallback 提取对话历史失败:`, error);
    }

    return messages;
  }

  /**
   * 从 ChatGPT 消息 element 中提取纯文本内容
   *
   * ChatGPT 的消息结构通常为:
   * <article data-message-author-role="user">
   *   <div>
   *     <div>
   *       <div>
   *         <p>段落</p>
   *       </div>
   *     </div>
   *   </div>
   * </article>
   *
   * 或:
   * <section data-testid="conversation-turn-X">
   *   <div>
   *     <div class="markdown">
   *       <p>段落</p>
   *     </div>
   *   </div>
   * </section>
   */
  private extractChatGPTMessageText(article: HTMLElement): string {
    // 方法1: 查找具有特定 class 的文本容器（ChatGPT 常用模式）
    // 查找包含文本内容的深层 div
    const textContainer = article.querySelector<HTMLElement>(
      this.selectors.textContent,
    );
    if (textContainer && textContainer.textContent) {
      return textContainer.textContent.trim();
    }

    // 方法2: 查找所有 p 标签（适用于包含 markdown 渲染内容的场景）
    const paragraphs = article.querySelectorAll('p');
    if (paragraphs.length > 0) {
      let text = '';
      paragraphs.forEach(p => {
        const line = p.textContent?.trim();
        if (line) { text += line + '\n'; }
      });
      const trimmed = text.trim();
      if (trimmed) { return trimmed; }
    }

    // 方法3: 获取 article 的直接文本（跳过脚本、样式等）
    // 克隆节点并移除不需要的元素
    const clone = article.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, svg, button').forEach(el => el.remove());

    // 获取所有文本行并过滤空白
    const lines: string[] = [];
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, null);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const line = node.textContent?.trim();
      if (line) { lines.push(line); }
    }

    return lines.join('\n');
  }
}
