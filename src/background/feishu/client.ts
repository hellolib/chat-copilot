/**
 * Feishu API Client
 * 飞书开放平台 API 封装，用于知识库文档创建与内容写入
 */

import { FeishuConfig, FeishuSpace, KnowledgeResult, SaveToFeishuResponse } from '@shared/types';
import { AppError, ErrorCode, ErrorHandler } from '@shared/errors';

const FEISHU_BASE_URL = 'https://open.feishu.cn/open-apis';

interface TenantAccessTokenResponse {
  code: number;
  msg: string;
  tenant_access_token: string;
  expire: number;
}

interface FeishuApiResponse<T> {
  code: number;
  msg: string;
  data?: T;
}

interface CreateNodeResponse {
  node: {
    space_id: string;
    node_token: string;
    obj_token: string;
    obj_type: string;
    parent_node_token: string;
    node_type: string;
    title: string;
  };
}

interface ListSpacesResponse {
  items: Array<{
    space_id: string;
    name: string;
    description?: string;
    space_type?: string;
  }>;
  page_token?: string;
  has_more?: boolean;
}

interface CreateBlockResponse {
  block: {
    block_id: string;
    parent_id: string;
    block_type: number;
  };
}

export class FeishuClient {
  private config: FeishuConfig;
  private token: string | null = null;
  private tokenExpireAt = 0;

  constructor(config: FeishuConfig) {
    this.config = config;
  }

  /**
   * 获取 tenant_access_token（自动缓存与刷新）
   */
  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.tokenExpireAt - now > 60) {
      return this.token;
    }

    try {
      const response = await fetch(`${FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          app_id: this.config.appId,
          app_secret: this.config.appSecret,
        }),
      });

      if (!response.ok) {
        throw new AppError(ErrorCode.API_ERROR, `获取飞书 token 失败: ${response.status}`);
      }

      const data = (await response.json()) as TenantAccessTokenResponse;

      if (data.code !== 0) {
        throw new AppError(ErrorCode.API_ERROR, `飞书认证失败: ${data.msg}`);
      }

      this.token = data.tenant_access_token;
      this.tokenExpireAt = now + data.expire;
      return this.token!;
    } catch (error) {
      ErrorHandler.logError(error, 'FeishuClient.getAccessToken');
      throw new AppError(ErrorCode.API_ERROR, '获取飞书访问凭证失败，请检查 App ID 和 App Secret 配置', error);
    }
  }

  /**
   * 发起飞书 API 请求
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<FeishuApiResponse<T>> {
    const token = await this.getAccessToken();
    const url = `${FEISHU_BASE_URL}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new AppError(ErrorCode.API_ERROR, `飞书 API 请求失败: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<FeishuApiResponse<T>>;
  }

  /**
   * 测试连接（通过获取 token 验证配置有效性）
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const token = await this.getAccessToken();
      if (token) {
        return { success: true, message: '连接成功' };
      }
      return { success: false, message: '无法获取访问凭证' };
    } catch (error) {
      return { success: false, message: ErrorHandler.getErrorMessage(error) };
    }
  }

  /**
   * 获取有权限的知识空间列表
   */
  async listSpaces(): Promise<FeishuSpace[]> {
    const result = await this.request<ListSpacesResponse>('GET', '/wiki/v2/spaces?page_size=50');

    if (result.code !== 0) {
      throw new AppError(ErrorCode.API_ERROR, `获取知识空间列表失败: ${result.msg}`);
    }

    return (result.data?.items ?? []).map(item => ({
      spaceId: item.space_id,
      name: item.name,
      description: item.description,
      spaceType: item.space_type,
    }));
  }

  /**
   * 在知识库中创建文档节点
   */
  async createWikiNode(
    spaceId: string,
    title: string,
    parentNodeToken?: string,
  ): Promise<{ nodeToken: string; objToken: string }> {
    const body: Record<string, string> = {
      obj_type: 'docx',
      node_type: 'origin',
      title,
    };

    if (parentNodeToken) {
      body.parent_node_token = parentNodeToken;
    }

    const result = await this.request<CreateNodeResponse>(
      'POST',
      `/wiki/v2/spaces/${spaceId}/nodes`,
      body,
    );

    if (result.code !== 0) {
      throw new AppError(ErrorCode.API_ERROR, `创建知识库节点失败: ${result.msg}`);
    }

    if (!result.data?.node) {
      throw new AppError(ErrorCode.API_ERROR, '创建知识库节点失败: 响应数据为空');
    }

    return {
      nodeToken: result.data.node.node_token,
      objToken: result.data.node.obj_token,
    };
  }

  /**
   * 向文档写入内容块（文本段落）
   */
  async addTextBlocks(
    documentId: string,
    texts: string[],
  ): Promise<void> {
    const children = texts.map((text, index) => ({
      block_id: `block_${Date.now()}_${index}`,
      block_type: 2, // 文本块
      text: {
        elements: [
          {
            text_run: {
              content: text,
              text_element_style: {},
            },
          },
        ],
        style: {},
      },
    }));

    const result = await this.request<CreateBlockResponse>(
      'POST',
      `/docx/v1/documents/${documentId}/blocks/${documentId}/children`,
      { children },
    );

    if (result.code !== 0) {
      throw new AppError(ErrorCode.API_ERROR, `写入文档内容失败: ${result.msg}`);
    }
  }

  /**
   * 添加标题块到文档
   */
  async addHeadingBlocks(
    documentId: string,
    headings: Array<{ level: number; text: string }>,
  ): Promise<void> {
    // 标题 block_type: 3=Heading1, 4=Heading2, 5=Heading3, etc.
    const blockTypeMap: Record<number, number> = {
      1: 3,
      2: 4,
      3: 5,
    };

    const children = headings.map((h, index) => ({
      block_id: `heading_${Date.now()}_${index}`,
      block_type: blockTypeMap[h.level] ?? 4,
      heading: {
        elements: [
          {
            text_run: {
              content: h.text,
              text_element_style: {},
            },
          },
        ],
        style: {},
      },
    }));

    const result = await this.request<CreateBlockResponse>(
      'POST',
      `/docx/v1/documents/${documentId}/blocks/${documentId}/children`,
      { children },
    );

    if (result.code !== 0) {
      throw new AppError(ErrorCode.API_ERROR, `写入标题失败: ${result.msg}`);
    }
  }

  /**
   * 将知识提炼结果完整写入飞书知识库文档
   */
  async saveKnowledge(
    knowledge: KnowledgeResult,
  ): Promise<SaveToFeishuResponse> {
    const spaceId = this.config.spaceId;
    if (!spaceId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '请先选择目标知识空间');
    }

    try {
      // 1. 创建知识库文档节点
      const { nodeToken, objToken } = await this.createWikiNode(
        spaceId,
        knowledge.title,
        this.config.parentNodeToken,
      );

      const documentId = objToken;

      // 2. 写入文档标题区域：摘要
      await this.addTextBlocks(documentId, [knowledge.summary]);

      // 3. 写入关键要点（作为标题 + 文本）
      if (knowledge.keyPoints.length > 0) {
        await this.addHeadingBlocks(documentId, [{ level: 2, text: '关键要点' }]);
        const bulletPoints = knowledge.keyPoints.map((point, i) => `${i + 1}. ${point}`);
        await this.addTextBlocks(documentId, bulletPoints);
      }

      // 4. 写入详细内容
      await this.addHeadingBlocks(documentId, [{ level: 2, text: '详细内容' }]);
      // 按段落拆分详细内容
      const detailParagraphs = knowledge.details
        .split('\n')
        .filter(p => p.trim().length > 0);
      await this.addTextBlocks(documentId, detailParagraphs);

      // 5. 写入来源信息
      await this.addHeadingBlocks(documentId, [{ level: 2, text: '来源信息' }]);
      await this.addTextBlocks(documentId, [
        `来源平台: ${knowledge.sourcePlatform}`,
        `来源链接: ${knowledge.sourceUrl}`,
        `提炼时间: ${new Date(knowledge.createdAt).toLocaleString('zh-CN')}`,
      ]);

      // 6. 写入标签
      if (knowledge.tags.length > 0) {
        await this.addTextBlocks(documentId, [`标签: ${knowledge.tags.join('、')}`]);
      }

      // 构建文档URL
      const documentUrl = `https://www.feishu.cn/wiki/${nodeToken}`;

      return {
        success: true,
        documentUrl,
        documentId,
        nodeToken,
      };
    } catch (error) {
      ErrorHandler.logError(error, 'FeishuClient.saveKnowledge');
      throw new AppError(ErrorCode.API_ERROR, '保存到飞书知识库失败', error);
    }
  }
}
