/**
 * Content Script 入口
 * 注入到 AI 平台页面
 */

import './styles.css';
import { PlatformDetector } from './adapters/detector';
import { GenericAdapter } from './adapters/generic';
import { UIManager } from './ui/manager';
import { MessageType } from '@shared/types';

class ContentScript {
  private detector: PlatformDetector;
  private uiManager: UIManager | null = null;
  private refreshTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.detector = new PlatformDetector();
  }

  /**
   * 初始化
   */
  async init(): Promise<void> {
    const adapter = this.detector.detect() ?? new GenericAdapter();

    console.log('chat copilot init...');

    this.uiManager = new UIManager(adapter);
    this.uiManager.init();

    // 监听 DOM 变化，处理动态加载
    if (adapter.name !== 'Generic') {
      this.observeDOM();
    }

    // 监听来自 Popup 的消息
    this.setupMessageListener();
  }

  /**
   * 监听 DOM 变化
   * 使用防抖机制避免频繁触发导致页面卡死
   */
  private observeDOM(): void {
    const observer = new MutationObserver(() => {
      // 清除之前的定时器
      if (this.refreshTimeout !== null) {
        clearTimeout(this.refreshTimeout);
      }

      // 防抖：300ms 后执行 refresh
      this.refreshTimeout = setTimeout(() => {
        this.uiManager?.refresh();
        this.refreshTimeout = null;
      }, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * 设置消息监听器
   */
  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'TOGGLE_PROMPT_SIDEBAR') {
        this.uiManager?.togglePromptSidebar();
        sendResponse({ success: true });
      }
      if (message.type === MessageType.OPEN_PROMPT_SIDEBAR) {
        const tab = (message.payload as { tab?: 'square' | 'favorites' } | undefined)?.tab ?? 'square';
        this.uiManager?.openPromptSidebarTab(tab);
        sendResponse({ success: true });
      }
      return true;
    });
  }
}

// 启动
const contentScript = new ContentScript();
contentScript.init();
