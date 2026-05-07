/**
 * Export Configuration
 */

export const EXPORT_MESSAGE_TYPES = {
  EXPORT_CHAT: 'EXPORT_CHAT',
} as const;

export interface ExportConfig {
  /** Filename template, e.g. "{platform}_{title}_{timestamp}" */
  filenameTemplate: string;
  /** Whether to include a Table of Contents in the markdown */
  includeTOC: boolean;
  /** Whether to include YAML frontmatter */
  includeFrontMatter: boolean;
  /** Export method: 'dom' for DOM parsing, 'clipboard' for copy-button approach */
  exportMethod: 'dom' | 'clipboard';
}

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  filenameTemplate: '{platform}_{title}_{timestamp}',
  includeTOC: true,
  includeFrontMatter: true,
  exportMethod: 'dom',
};

export interface ExportedMessage {
  id: string;
  role: 'user' | 'assistant';
  contentText: string;
  contentHtml: HTMLElement | null;
  originalIndex: number;
}

export interface ExportChatData {
  title: string;
  platform: string;
  threadUrl: string;
  messages: ExportedMessage[];
  messageCount: number;
  exportedAt: Date;
}
