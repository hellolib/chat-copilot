/**
 * Background Service Worker
 * 后台服务，处理核心逻辑
 */

import { MessageHandler } from './handlers/message';
import { ModelManager } from './managers/model';
import { StorageManager } from './managers/storage';

// 初始化管理器
const storageManager = new StorageManager();
const modelManager = new ModelManager(storageManager);
const messageHandler = new MessageHandler(modelManager, storageManager);

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Chat Copilot 安装成功');
    await storageManager.initDefaults();
  }
});

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  messageHandler.handle(message, sender, sendResponse);
  return true; // 保持消息通道开启
});

console.log('Chat Copilot Background Service Worker 已启动');
