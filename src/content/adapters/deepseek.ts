/**
 * DeepSeek Adapter
 */

import { BaseAdapter } from './base';
import { ConversationMessage } from '@shared/types';
import { LoadingOverlay } from '@shared/loadingOverlay';

/** 虚拟列表所在的滚动容器选择器（消息列表与右侧目录共用此 class） */
const VIRTUAL_LIST_SELECTOR = '.ds-virtual-list-items';

/**
 * 找消息列表的滚动容器：
 * 1. 页面里可能存在多个 .ds-virtual-list-items（消息列表 + 右侧目录），
 *    按"是否含 [data-virtual-list-item-key] 子项"区分主消息列表
 * 2. 自底向上查首个 overflow-y 为 auto/scroll 的祖先作为滚动元素
 */
export function findDeepSeekScrollContainer(): HTMLElement | null {
  const lists = document.querySelectorAll<HTMLElement>(VIRTUAL_LIST_SELECTOR);
  let messageList: HTMLElement | null = null;
  for (const list of lists) {
    if (list.querySelector('[data-virtual-list-item-key]')) {
      messageList = list;
      break;
    }
  }
  let el: HTMLElement | null = messageList ?? lists[0] ?? null;
  while (el && el !== document.body) {
    const overflowY = window.getComputedStyle(el).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') { return el; }
    el = el.parentElement;
  }
  return null;
}

/**
 * 取右侧目录条目数（= 当前会话的 user 消息总数）。
 *
 * 右侧目录与主消息列表都使用 .ds-virtual-list-items，但子项不同：
 * - 主消息列表：[data-virtual-list-item-key]
 * - 右侧目录: 直接 div 子项（class 是构建哈希，不可靠）
 *
 * 通过"不含 [data-virtual-list-item-key] 但有直接 div 子项"识别右侧目录。
 * 返回 0 表示页面上没有目录（≤2 轮对话时 DeepSeek 不渲染目录）。
 */
export function getDeepSeekTocCount(): number {
  const lists = document.querySelectorAll<HTMLElement>(VIRTUAL_LIST_SELECTOR);
  for (const list of lists) {
    if (list.querySelector('[data-virtual-list-item-key]')) { continue; }
    const visible = list.querySelector<HTMLElement>('.ds-virtual-list-visible-items');
    if (visible) { return visible.children.length; }
    return list.querySelectorAll<HTMLElement>(':scope > div').length;
  }
  return 0;
}

/** 当前 DOM 中已挂载的 user 消息条数 */
function countMountedUserMessages(): number {
  const direct = document.querySelectorAll('.fbb737a4').length;
  if (direct > 0) { return direct; }
  // .fbb737a4 哈希失效时退回 .ds-message 结构判定
  let count = 0;
  document.querySelectorAll('.ds-message').forEach((m) => {
    if (!m.querySelector('.ds-markdown.ds-assistant-message-main-content')) { count++; }
  });
  return count;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 让 DeepSeek 虚拟列表把全部消息节点挂载到 DOM。
 *
 * 实现要点:
 * 1. 通过右侧目录条目数判断是否需要滚动；如果当前 DOM 已含全部消息直接返回
 * 2. 真要滚动时显示全屏蒙版，避免用户在加载期间点中底层页面，并实时显示进度
 * 3. 滚到顶 → 按视口高度 80% 步长向下分段滚 → 每段等 ~280ms 让虚拟列表挂载新节点
 * 4. 通过 onStep 回调把"当前 DOM 状态"反馈给调用方做增量收集
 * 5. 收尾停在底部（不还原原 scrollTop，避免回滚导致已挂载节点被卸载）
 */
export async function ensureDeepSeekMessagesMounted(
  onStep?: () => void,
): Promise<void> {
  const expected = getDeepSeekTocCount();
  const initialMounted = countMountedUserMessages();

  // 目录数 > 0 且 DOM 已经含全部消息 → 无需滚动
  // 目录数 = 0 表示对话很短（≤2 轮），DeepSeek 自己不渲染目录，DOM 通常已完整
  if (expected === 0 || initialMounted >= expected) {
    onStep?.();
    return;
  }

  const container = findDeepSeekScrollContainer();
  if (!container) {
    onStep?.();
    return;
  }

  LoadingOverlay.show(`正在加载历史对话… (${initialMounted}/${expected})`);

  try {
    container.scrollTop = 0;
    await sleep(600);
    onStep?.();
    LoadingOverlay.update(`正在加载历史对话… (${countMountedUserMessages()}/${expected})`);

    const step = Math.max(300, container.clientHeight * 0.8);
    let stagnantRounds = 0;
    // 上限保护，避免极端情况死循环（200 步 × ~80% 视口足以覆盖几千行对话）
    for (let i = 0; i < 200; i++) {
      const before = container.scrollTop;
      container.scrollTop = before + step;
      await sleep(280);
      onStep?.();
      LoadingOverlay.update(
        `正在加载历史对话… (${countMountedUserMessages()}/${expected})`,
      );

      const movedNothing = container.scrollTop === before;
      const reachedBottom =
        container.scrollTop + container.clientHeight >= container.scrollHeight - 4;

      if (movedNothing && reachedBottom) { break; }
      stagnantRounds = movedNothing ? stagnantRounds + 1 : 0;
      if (stagnantRounds >= 3) { break; }
    }

    // 收尾：到底再触发一次回调（个别消息可能在最末才挂载）
    container.scrollTop = container.scrollHeight;
    await sleep(400);
    onStep?.();
  } finally {
    LoadingOverlay.hide();
  }
}

export class DeepSeekAdapter extends BaseAdapter {
  name = 'DeepSeek';
  hostPatterns = ['chat.deepseek.com'];

  /**
   * prepareForExport 收集到的全量消息缓存（按首次出现顺序）。
   * 在虚拟列表把节点回收后，仍保有完整对话内容供 getConversationHistory 使用。
   */
  private collectedMessages: ConversationMessage[] | null = null;

  /** DeepSeek DOM 选择器 */
  private selectors = {
    /**
     * user 消息的文本容器。
     * ⚠️ .fbb737a4 是构建哈希，可能随 DeepSeek 发版变化；
     *    若失效则代码会自动回退到 .ds-message 结构识别。
     */
    userText: '.fbb737a4',
    /** assistant 消息正文渲染容器 — ds- 前缀是设计系统类，稳定 */
    assistantMarkdown: '.ds-markdown.ds-assistant-message-main-content',
    /** 整条消息（user 与 assistant 共用，用作 fallback 锚点） */
    message: '.ds-message',
  };

  getChatTitle(): string {
    return document.title.replace(/\s*[-—]\s*DeepSeek.*$/i, '').trim() || 'chat';
  }

  getInputElement(): HTMLElement | null {
    return document.querySelector('textarea[placeholder]');
  }

  getSendButton(): HTMLElement | null {
    return document.querySelector('div[style="width: fit-content;"]');
  }

  getInputValue(): string {
    const input = this.getInputElement() as HTMLTextAreaElement | null;
    return input?.value ?? '';
  }

  setInputValue(value: string): void {
    const input = this.getInputElement() as HTMLTextAreaElement | null;
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event('input', {bubbles: true}));
    }
  }

  /**
   * 提取 DeepSeek 对话历史
   *
   * 多轮对话目录会展示用户消息前若干字。早期实现用 .ds-message 整体的 textContent
   * 作为 user 文本，但该容器在 hover/动画 / 内嵌附件等场景下会混入其它子节点文本，
   * 导致目录串位。这里改为优先使用专门的 user 文本节点 .fbb737a4，并与 assistant
   * 节点联合查询、按 DOM 顺序还原对话顺序。
   *
   * DeepSeek 用激进虚拟列表，超出视口的消息会被卸载且不会发起新的网络请求
   * （数据全部缓存在 SPA 内存中）。因此仅靠当前 DOM 无法拿到全量对话；
   * 由 prepareForExport() 先做一遍滚动收集，本方法优先返回该缓存。
   */
  getConversationHistory(): ConversationMessage[] {
    if (this.collectedMessages && this.collectedMessages.length > 0) {
      return this.collectedMessages.slice();
    }
    return this.extractMessagesFromDOM();
  }

  /**
   * 让虚拟列表挂载全部消息节点并将其内容收集到 collectedMessages。
   * 实现细节见模块级 ensureDeepSeekMessagesMounted。
   */
  async prepareForExport(): Promise<void> {
    const seen = new Set<string>();
    const collected: ConversationMessage[] = [];

    const collect = () => {
      this.extractMessagesFromDOM().forEach((msg) => {
        const key = `${msg.role}::${msg.content}`;
        if (!seen.has(key)) {
          seen.add(key);
          collected.push(msg);
        }
      });
    };

    await ensureDeepSeekMessagesMounted(collect);

    this.collectedMessages = collected;
  }

  /**
   * 直接从当前 DOM 提取消息（不含缓存逻辑）。
   * prepareForExport 会反复调用以增量收集。
   */
  private extractMessagesFromDOM(): ConversationMessage[] {
    const messages: ConversationMessage[] = [];

    try {
      const nodes = document.querySelectorAll<HTMLElement>(
        `${this.selectors.userText}, ${this.selectors.assistantMarkdown}`,
      );

      if (nodes.length > 0) {
        nodes.forEach((node) => {
          const role: 'user' | 'assistant' =
            node.classList.contains('ds-markdown') ? 'assistant' : 'user';
          const text = node.textContent?.trim();
          if (text) { messages.push({ role, content: text }); }
        });
        return messages;
      }

      // Fallback：当 .fbb737a4 哈希类被 DeepSeek 改名时，
      // 退回到 .ds-message 结构判定（不含 .ds-markdown 即视为 user）
      const items = document.querySelectorAll<HTMLElement>(this.selectors.message);
      items.forEach((item) => {
        const md = item.querySelector<HTMLElement>(this.selectors.assistantMarkdown);
        if (md) {
          const text = md.textContent?.trim();
          if (text) { messages.push({ role: 'assistant', content: text }); }
        } else {
          const text = item.textContent?.trim();
          if (text) { messages.push({ role: 'user', content: text }); }
        }
      });
    } catch (error) {
      console.warn(`[Chat Copilot - ${this.name}] 提取对话历史失败:`, error);
    }

    return messages;
  }

  /**
   * 查找按钮容器 - 使用多种策略
   */
  findButtonContainer(): HTMLElement | null {
    return this.findElementWithStrategies([
      // 策略1: 通过发送按钮的父元素查找
      () => {
        const sendButton = this.getSendButton();
        return sendButton?.parentElement as HTMLElement || null;
      },

      // 策略2: 通过输入框的父容器查找
      () => {
        const input = this.getInputElement();
        if (input) {
          const form = input.closest('form');
          if (form) {
            const buttonContainer = form.querySelector('div.flex, div.button-container, div[class*="toolbar"]');
            return buttonContainer as HTMLElement || null;
          }
        }
        return null;
      },

      // 策略3: 查找包含多个按钮的容器
      () => {
        const buttons = document.querySelectorAll('button[type="submit"], button[type="button"]');
        for (const btn of buttons) {
          const parent = btn.parentElement;
          if (parent && parent.querySelectorAll('button').length > 1) {
            return parent as HTMLElement;
          }
        }
        return null;
      },
    ]);
  }
}
