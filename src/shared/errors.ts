/**
 * 统一错误处理
 */

export enum ErrorCode {
  EXTENSION_CONTEXT_INVALIDATED = 'EXTENSION_CONTEXT_INVALIDATED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * 错误处理工具
 */
export class ErrorHandler {
  /**
   * 处理错误并返回用户友好的消息
   */
  static getErrorMessage(error: unknown): string {
    if (error instanceof AppError) {
      switch (error.code) {
        case ErrorCode.EXTENSION_CONTEXT_INVALIDATED:
          return '扩展已更新，请刷新页面后重试';
        case ErrorCode.NETWORK_ERROR:
          return '网络连接失败，请检查网络设置';
        case ErrorCode.API_ERROR:
          return error.message || 'API 调用失败，请检查配置';
        case ErrorCode.VALIDATION_ERROR:
          return error.message || '输入验证失败';
        case ErrorCode.STORAGE_ERROR:
          return '存储操作失败，请重试';
        default:
          return error.message || '发生未知错误';
      }
    }

    if (error instanceof Error) {
      // 检查是否是扩展上下文失效
      if (error.message.includes('invalidated') || error.message.includes('Extension context')) {
        return '扩展已更新，请刷新页面后重试';
      }
      return error.message || '发生错误';
    }

    return '发生未知错误，请重试';
  }

  /**
   * 记录错误
   */
  static logError(error: unknown, context?: string): void {
    const contextMsg = context ? `[${context}]` : '';
    console.error(`Chat Copilot Error ${contextMsg}:`, error);
  }
}
