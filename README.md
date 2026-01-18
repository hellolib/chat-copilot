<div align="center">

<div style="background-color: white; padding: 20px; border-radius: 50%; display: inline-block;">

<img src="src/assets/chat-copilot-btn.png" alt="Chat Copilot Logo" width="80"/>

</div>

# Chat Copilot

### AI 对话增强助手 - 让每一次 AI 对话都更高效

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [贡献指南](#-贡献指南)

</div>

---

## 项目简介

Chat Copilot 是一款基于 Chrome Extension Manifest V3 标准开发的 AI 对话增强助手，旨在提升用户在使用 AI 平台时的效率和体验。通过智能提示词优化，帮助用户获得更精准、更高质量的 AI 回复。

支持的平台:

[ChatGPT](https://chatgpt.com) · [Claude](https://claude.ai) · [Gemini](https://gemini.google.com) · [Grok](https://grok.com) · [千问](https://qianwen.com) · [千问(国际版)](https://chat.qwen.ai) · [文心一言](https://yiyan.baidu.com) · [腾讯元宝](https://yuanbao.tencent.com) · [DeepSeek](https://chat.deepseek.com)

---

## 功能特性

### 智能提示词优化

- **自动优化**：基于规则引擎智能分析和优化用户输入的提示词
- **多维度增强**：提供清晰度、结构化、上下文完整性等多维度优化建议
- **实时预览**：在发送前预览优化后的提示词，支持一键应用

---

## 开始使用

### 方式一：Chrome 商店安装（推荐）

1. 访问 [Chrome Web Store](https://chrome.google.com/webstore/detail/chat-copilot/xxx)
2. 点击「添加至 Chrome」按钮
3. 在弹出确认框中点击「添加扩展程序」
4. 安装完成，在支持的 AI 平台页面即可看到功能入口

### 方式二：开发者模式安装

1. **克隆仓库**

```bash
git clone https://github.com/hellolib/chat-copilot.git
cd chat-copilot
```

2. **安装依赖**

```bash
npm install
```

3. **构建项目**

```bash
npm run build
```

4. **加载扩展**

   - 打开 Chrome 浏览器，访问 `chrome://extensions/`
   - 开启右上角的「开发者模式」
   - 点击「加载已解压的扩展程序」
   - 选择项目根目录下的 `dist` 文件夹
   - 扩展安装完成，在支持的 AI 平台页面即可看到功能入口

---

## 贡献指南

欢迎所有形式的贡献！

### 贡献方式

1. **报告问题**：在 [Issues](https://github.com/hellolib/chat-copilot/issues) 中报告 Bug 或提出功能建议
2. **提交代码**：Fork 项目，创建分支，提交 Pull Request
3. **完善文档**：改进文档内容，补充使用示例
4. **分享反馈**：分享使用体验，帮助改进产品

### 开发规范

1. **代码风格**
   - 遵循 ESLint 和 Prettier 配置
   - 使用有意义的变量和函数命名
   - 添加必要的注释和文档

2. **提交规范**
   - 提交信息清晰明确
   - 参考 [Conventional Commits](https://www.conventionalcommits.org/)
   - 单次提交聚焦单一功能

3. **测试要求**
   - 确保代码通过类型检查（`npm run type-check`）
   - 确保代码通过 Lint 检查（`npm run lint`）
   - 在多个平台上测试功能

---

## 许可证

本项目采用 [Apache License 2.0](LICENSE) 开源协议。

---

## 致谢

🙏 感谢所有为本项目做出贡献的开发者和用户。

特别感谢以下开源项目：
- [Chrome Extension Samples](https://github.com/GoogleChrome/chrome-extensions-samples)
- [TypeScript](https://www.typescriptlang.org/)
- [Webpack](https://webpack.js.org/)
- [Claude Code](https://claude.ai/code)

---

## 联系方式

- **GitHub Issues**：[提交问题](https://github.com/hellolib/chat-copilot/issues)
- **📮 Email**：bigoxevan@gmil.com

---

<div align="center">

**如果这个项目对您有帮助，请给一个 ⭐️ Star**

Made with ❤️ by Chat Copilot Team

</div>
