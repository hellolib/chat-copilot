/**
 * Message Handler
 * 处理扩展内部消息通信
 */

import { Message, MessageType, OptimizeRequest, ModelConfig, MessageResponse, CustomRule, FeishuConfig, ExtractKnowledgeRequest, SaveToFeishuRequest } from '@shared/types';
import { ModelManager } from '../managers/model';
import { StorageManager } from '../managers/storage';
import { SecurityChecker } from '../security';
import { ErrorHandler, AppError, ErrorCode } from '@shared/errors';
import { FeishuClient } from '../feishu/client';
import { extractKnowledge } from '../knowledge/extractor';

export class MessageHandler {
  private modelManager: ModelManager;
  private storageManager: StorageManager;
  private securityChecker: SecurityChecker;

  constructor(modelManager: ModelManager, storageManager: StorageManager) {
    this.modelManager = modelManager;
    this.storageManager = storageManager;
    this.securityChecker = new SecurityChecker();
  }

  /**
   * 处理消息
   */
  async handle(
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ): Promise<void> {
    try {
      switch (message.type) {
        case MessageType.OPTIMIZE_PROMPT: {
          const request = message.payload as OptimizeRequest;
          if (!request || !request.prompt) {
            throw new AppError(ErrorCode.VALIDATION_ERROR, '缺少必需的 prompt 参数');
          }

          const result = await this.modelManager.optimize(request);
          
          // 优化成功时记录统计
          if (result) {
            try {
              await this.storageManager.recordOptimization();
            } catch (storageError) {
              ErrorHandler.logError(storageError, 'recordOptimization');
              // 统计记录失败不影响优化结果返回
            }
          }
          
          sendResponse({ success: true, data: result });
          break;
        }

        case MessageType.TEST_CONNECTION: {
          const config = message.payload as ModelConfig;
          if (!config || !config.endpoint || !config.model) {
            throw new AppError(ErrorCode.VALIDATION_ERROR, '缺少必需的模型配置参数');
          }

          const connected = await this.modelManager.testConnection(config);
          sendResponse({ success: true, data: { connected } });
          break;
        }

        case MessageType.GET_SETTINGS: {
          try {
            const settings = await this.storageManager.get('settings');
            sendResponse({ success: true, data: settings });
          } catch (error) {
            throw new AppError(ErrorCode.STORAGE_ERROR, '获取设置失败', error);
          }
          break;
        }

        case MessageType.SAVE_SETTINGS: {
          try {
            const settings = message.payload;
            if (!settings) {
              throw new AppError(ErrorCode.VALIDATION_ERROR, '缺少设置数据');
            }
            await this.storageManager.set('settings', settings);
            sendResponse({ success: true });
          } catch (error) {
            if (error instanceof AppError) {
              throw error;
            }
            throw new AppError(ErrorCode.STORAGE_ERROR, '保存设置失败', error);
          }
          break;
        }

        case MessageType.GET_CUSTOM_RULES: {
          try {
            const rules = await this.storageManager.getCustomRules();
            sendResponse({ success: true, data: rules });
          } catch (error) {
            throw new AppError(ErrorCode.STORAGE_ERROR, '获取自定义优化规则失败', error);
          }
          break;
        }

        case MessageType.SAVE_CUSTOM_RULES: {
          try {
            const rule = message.payload as Omit<CustomRule, 'id' | 'createdAt' | 'updatedAt'>;
            if (!rule || !rule.name || !rule.content) {
              throw new AppError(ErrorCode.VALIDATION_ERROR, '缺少必需的规则数据');
            }

            const securityCheck = this.securityChecker.check(rule.content);
            if (!securityCheck.isSafe) {
              throw new AppError(ErrorCode.VALIDATION_ERROR, `规则内容包含不安全内容: ${securityCheck.detectedIssues.join(', ')}`);
            }

            const savedRule = await this.storageManager.addCustomRule(rule);
            sendResponse({ success: true, data: savedRule });
          } catch (error) {
            if (error instanceof AppError) {
              throw error;
            }
            throw new AppError(ErrorCode.STORAGE_ERROR, '保存自定义优化规则失败', error);
          }
          break;
        }

        case MessageType.DELETE_CUSTOM_RULE: {
          try {
            const ruleId = message.payload as string;
            if (!ruleId) {
              throw new AppError(ErrorCode.VALIDATION_ERROR, '缺少规则ID');
            }
            await this.storageManager.deleteCustomRule(ruleId);
            sendResponse({ success: true });
          } catch (error) {
            if (error instanceof AppError) {
              throw error;
            }
            throw new AppError(ErrorCode.STORAGE_ERROR, '删除自定义优化规则失败', error);
          }
          break;
        }

        case MessageType.OPEN_OPTIONS: {
          try {
            if (chrome.runtime.openOptionsPage) {
              await chrome.runtime.openOptionsPage();
            } else {
              const optionsUrl = chrome.runtime.getURL('options/index.html');
              await chrome.tabs.create({ url: optionsUrl });
            }
            sendResponse({ success: true });
          } catch (error) {
            throw new AppError(ErrorCode.UNKNOWN_ERROR, '打开设置页失败', error);
          }
          break;
        }

        // ========================================
        // 知识提炼与飞书知识库
        // ========================================

        case MessageType.EXTRACT_KNOWLEDGE: {
          const extractRequest = message.payload as ExtractKnowledgeRequest;
          if (!extractRequest || !extractRequest.messages || extractRequest.messages.length === 0) {
            throw new AppError(ErrorCode.VALIDATION_ERROR, '缺少对话消息数据');
          }

          const result = await extractKnowledge(
            extractRequest.messages,
            async (systemPrompt: string, userContent: string) => {
              // 复用模型管理器调用 AI
              const response = await this.modelManager.optimize({
                prompt: `${systemPrompt}\n\n${userContent}`,
                platform: extractRequest.platform,
              });
              return response.optimized;
            },
          );

          // 补充来源信息（URL 由 content script 传入，background worker 无 window 对象）
          result.sourceUrl = extractRequest.sourceUrl || '';
          result.sourcePlatform = extractRequest.platform;

          sendResponse({
            success: true,
            data: {
              originalConversation: extractRequest.messages,
              knowledge: result,
            },
          });
          break;
        }

        case MessageType.GET_FEISHU_CONFIG: {
          try {
            const feishuConfig = await this.storageManager.get<FeishuConfig>('feishuConfig');
            sendResponse({ success: true, data: feishuConfig ?? null });
          } catch (error) {
            throw new AppError(ErrorCode.STORAGE_ERROR, '获取飞书配置失败', error);
          }
          break;
        }

        case MessageType.SAVE_FEISHU_CONFIG: {
          try {
            const config = message.payload as FeishuConfig;
            if (!config || !config.appId || !config.appSecret) {
              throw new AppError(ErrorCode.VALIDATION_ERROR, '请填写完整的飞书应用配置');
            }
            await this.storageManager.set('feishuConfig', config);
            sendResponse({ success: true });
          } catch (error) {
            if (error instanceof AppError) {
              throw error;
            }
            throw new AppError(ErrorCode.STORAGE_ERROR, '保存飞书配置失败', error);
          }
          break;
        }

        case MessageType.TEST_FEISHU_CONNECTION: {
          try {
            const config = message.payload as FeishuConfig;
            if (!config || !config.appId || !config.appSecret) {
              throw new AppError(ErrorCode.VALIDATION_ERROR, '请填写完整的飞书应用配置');
            }

            const feishuClient = new FeishuClient(config);
            const testResult = await feishuClient.testConnection();
            sendResponse({ success: testResult.success, data: testResult });
          } catch (error) {
            const errorMessage = ErrorHandler.getErrorMessage(error);
            sendResponse({ success: false, error: errorMessage });
          }
          break;
        }

        case MessageType.GET_FEISHU_SPACES: {
          try {
            const config = message.payload as FeishuConfig;
            if (!config || !config.appId || !config.appSecret) {
              throw new AppError(ErrorCode.VALIDATION_ERROR, '请填写完整的飞书应用配置');
            }

            const feishuClient = new FeishuClient(config);
            const spaces = await feishuClient.listSpaces();
            sendResponse({ success: true, data: { spaces } });
          } catch (error) {
            const errorMessage = ErrorHandler.getErrorMessage(error);
            sendResponse({ success: false, error: errorMessage });
          }
          break;
        }

        case MessageType.SAVE_TO_FEISHU: {
          try {
            const saveRequest = message.payload as SaveToFeishuRequest;
            if (!saveRequest || !saveRequest.knowledge || !saveRequest.config) {
              throw new AppError(ErrorCode.VALIDATION_ERROR, '缺少保存数据');
            }

            const feishuClient = new FeishuClient(saveRequest.config);
            const saveResult = await feishuClient.saveKnowledge(saveRequest.knowledge);
            sendResponse({ success: true, data: saveResult });
          } catch (error) {
            const errorMessage = ErrorHandler.getErrorMessage(error);
            sendResponse({ success: false, error: errorMessage });
          }
          break;
        }

        default:
          throw new AppError(ErrorCode.UNKNOWN_ERROR, `未知的消息类型: ${message.type}`);
      }
    } catch (error) {
      ErrorHandler.logError(error, 'MessageHandler');
      const errorMessage = ErrorHandler.getErrorMessage(error);
      sendResponse({ success: false, error: errorMessage });
    }
  }
}
