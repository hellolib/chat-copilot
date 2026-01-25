<div align="center">

<img src="src/assets/chat-copilot-btn.svg" alt="Chat Copilot Logo" width="120"/>

# Chat Copilot

**AI 对话增强助手 - 让每一次 AI 对话都更高效**

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/ignafelbdjojmmofofhldldpgkceflal?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/chat-copilot/ignafelbdjojmmofofhldldpgkceflal)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

[🌐 官网](https://chatcopilot.com.cn) • [📦 Chrome 商店](https://chromewebstore.google.com/detail/chat-copilot/ignafelbdjojmmofofhldldpgkceflal) • [📖 文档](https://chatcopilot.com.cn/docs/guides/introduce)

</div>

---

## 项目简介

Chat Copilot 是一款基于 Chrome Extension Manifest V3 标准开发的 AI 对话增强助手，旨在提升用户在使用 AI 平台时的效率和体验。通过智能提示词优化，帮助用户获得更精准、更高质量的 AI 回复。

### 支持的平台

| 国际平台 | 国内平台 |
|---------|---------|
| <img src="src/assets/website-icons/chatgpt.png" width="16"/> [ChatGPT](https://chatgpt.com) | <img src="src/assets/website-icons/qianwen.png" width="16"/> [通义千问](https://qianwen.com) |
| <img src="src/assets/website-icons/claude.png" width="16"/> [Claude](https://claude.ai) | <img src="src/assets/website-icons/qianwen.png" width="16"/> [千问国际版](https://chat.qwen.ai) |
| <img src="src/assets/website-icons/gemini.png" width="16"/> [Gemini](https://gemini.google.com) | <img src="src/assets/website-icons/deepseek.png" width="16"/> [DeepSeek](https://chat.deepseek.com) |
| <img src="src/assets/website-icons/grok.png" width="16"/> [Grok](https://grok.com) | <img src="src/assets/website-icons/yiyan.png" width="16"/> [文心一言](https://yiyan.baidu.com) |
| | <img src="src/assets/website-icons/yuanbao.png" width="16"/> [腾讯元宝](https://yuanbao.tencent.com) |

---

## 功能特性

### 🚀 智能提示词优化

- **一键优化** - 基于规则引擎智能分析和优化用户输入的提示词
- **多维度增强** - 提供清晰度、结构化、上下文完整性等多维度优化
- **实时预览** - 发送前预览优化后的提示词，支持一键应用
- **自定义模型** - 支持自定义提示词优化模型，灵活配置优化策略
- **自定义提示词风格** - 支持自定义提示词风格，满足不同场景需求

### 🎯 核心优势

- **多平台支持** - 覆盖主流 AI 对话平台，一个插件搞定所有
- **隐私优先** - 数据本地存储，不上传任何对话内容
- **轻量快速** - 基于 Manifest V3，性能优异，资源占用低

---

## 快速开始

### 方式一：Chrome 商店安装（推荐）

1. 访问 [Chrome Web Store](https://chromewebstore.google.com/detail/chat-copilot/ignafelbdjojmmofofhldldpgkceflal)
2. 点击「添加至 Chrome」按钮
3. 在弹出确认框中点击「添加扩展程序」
4. 安装完成，在支持的 AI 平台页面即可看到功能入口

### 方式二：开发者模式安装

```bash
# 克隆仓库
git clone https://github.com/hellolib/chat-copilot.git
cd chat-copilot

# 安装依赖
npm install

# 构建项目
npm run build
```

**加载扩展：**

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目根目录下的 `build/chat-copilot` 文件夹
5. 扩展安装完成，在支持的 AI 平台页面即可看到功能入口

---

## 开发

```bash
# 开发模式（带监听）
npm run dev

# 类型检查
npm run type-check

# 代码检查
npm run lint

# 格式化代码
npm run format
```

---

## 贡献指南

欢迎所有形式的贡献！

| 贡献方式 | 说明 |
|---------|------|
| 报告问题 | 在 [Issues](https://github.com/hellolib/chat-copilot/issues) 中报告 Bug 或提出功能建议 |
| 提交代码 | Fork 项目，创建分支，提交 Pull Request |
| 完善文档 | 改进文档内容，补充使用示例 |
| 分享反馈 | 分享使用体验，帮助改进产品 |

**开发规范：**

- 遵循 ESLint 和 Prettier 配置
- 参考 [Conventional Commits](https://www.conventionalcommits.org/) 提交规范
- 确保代码通过 `npm run type-check` 和 `npm run lint` 检查

---

## TODO

- [ ] 导出聊天记录 - 支持多种格式、包含历史和元数据
- [ ] 提示词收藏夹 - 提示词对比页面收藏功能、管理收藏
- [ ] 暗黑模式优化 - 修复图标颜色、整体 UI 适配
- [ ] 支持图像平台 - 扩展至图像生成 AI 平台

---

## 许可证

本项目采用 [Apache License 2.0](LICENSE) 开源协议。

---

## 联系方式

- **官网**：[chatcopilot.com.cn](https://chatcopilot.com.cn)
- **GitHub Issues**：[提交问题](https://github.com/hellolib/chat-copilot/issues)
- **Email**：bigoxevan@gmail.com

---

<div align="center">

**如果这个项目对您有帮助，请给一个 Star ⭐**

Made with ❤️ by [Chat Copilot Team](https://github.com/hellolib/chat-copilot)

</div>
