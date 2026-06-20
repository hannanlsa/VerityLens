# VerityLens（真实透镜）

> 🛡️ 跨模态自校验 × 反虚假信息助手
> A cross-modal fact-checking assistant for the post-truth era.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Status: v0.4.0](https://img.shields.io/badge/Status-v0.4.0-green)](CHANGELOG.md)
[![Patent: Pending](https://img.shields.io/badge/Patent-Pending-red)](PATENT_PENDING.md)

## ✨ 项目定位

**VerityLens = 真实透镜**

- 🎯 核心 = 帮用户在搜索结果中识别广告 / SEO / 真实内容
- 🛡️ 特性 = **跨模态自校验**（ASR + OCR + 文本三元组）
- 🌍 形态 = **浏览器插件为主** + Docker 可选 + 油猴脚本（计划）+ CLI（计划）
- 🔒 原则 = **本地优先 + 隐私保护 + 自用场景**
- 🆓 开源 = AGPL-3.0 协议 + **永不商业化** = 永久免费

## 🚀 v0.2.0 新架构：双通道智能路由

```
┌─────────────────────────────────────────┐
│         VerityLens 浏览器插件            │
│                                         │
│  搜索结果 → 智能路由器 → 复杂度评估      │
│                          │              │
│               轻量───────┴───────复杂    │
│               │                  │      │
│          ┌────▼────┐      ┌──────▼──┐   │
│          │本地通道  │      │云端通道  │   │
│          │·关键词   │      │·DeepSeek│   │
│          │·正则规则 │      │·智谱GLM │   │
│          │·Tesseract│      │·通义千问 │   │
│          │·WebSpeech│      │·硅基流动 │   │
│          └────┬────┘      │·Groq    │   │
│               │           │·自定义   │   │
│               │      ┌────┴────┐     │   │
│               │      │Docker   │     │   │
│               │      │·Ollama  │     │   │
│               │      │·Qwen2.5 │     │   │
│               │      └────┬────┘     │   │
│               └──────┬─────┘          │   │
│                      ▼                │   │
│              统一5级置信度评分          │   │
│              颜色标注 + Hover Popup    │   │
└─────────────────────────────────────────┘
```

### 4 种通道模式

| 模式 | 说明 | 隐私 | 精度 |
|------|------|------|------|
| 🔒 纯本地 | 关键词+正则启发式 | ✅ 零泄露 | 低 |
| ⚡ 智能切换（推荐） | 轻量→本地，复杂→云端 | ⚠️ 复杂任务走云端 | 高 |
| ☁️ 仅云端 | 所有验证走 LLM | ⚠️ 全走云端 | 最高 |
| 🐳 仅 Docker | 自建 Ollama | ✅ 零泄露 | 高 |

### 🆓 免费模型支持（9家）

| 提供商 | 模型 | 免费额度 |
|--------|------|---------|
| 智谱GLM | GLM-4-Flash | **永久免费** |
| DeepSeek | DeepSeek-V3/R1 | 注册送500万token |
| 硅基流动 | Qwen2.5-7B 等 | 注册送2000万token |
| 通义千问 | Qwen-Turbo | 新用户100万token |
| Groq | Llama-3.3-70B | 免费速率限制 |
| Moonshot | Moonshot-v1 | 新用户送额度 |
| MiniMax | ABAB-6.5s | 注册送额度 |
| 零一万物 | Yi-Lightning | 注册送额度 |
| 百度千帆 | ERNIE-Lite | 每月免费额度 |

## 🎯 为什么需要 VerityLens？

**国产搜索现状**（2024 调研）：
- 百度：广告 20-30% + 真实内容 40-50%（最差）
- 360：广告 15-25% + 真实内容 50-60%（中等）
- 搜狗：广告 15-20% + 真实内容 50-60%（较好）
- **Google**：广告 5-10% + 真实内容 70-80%（最佳）

## 🏗️ 架构

```
verity-lens/
├── browser-extension/        # 浏览器插件（主力形态）
│   ├── background/           # Service Worker (MV3) + Background (MV2)
│   ├── common/
│   │   ├── verity-core.js    # 核心引擎 + 模型注册表 + 智能路由 + 统一通道
│   │   └── modules/          # 跨模态模块
│   │       ├── asr.js        # Web Speech ASR
│   │       ├── ocr.js        # Tesseract.js OCR
│   │       └── cross-modal.js # 三元组交叉验证 + 实体链接 + 统一时间轴
│   ├── content/
│   │   └── verity-injector.js # 搜索结果标注注入（含图片OCR）
│   ├── options/              # 设置页（模型选择器 + 免费模型引导）
│   ├── popup/                # 弹出面板
│   ├── welcome/              # 首次安装引导
│   └── manifest.json
├── userscript/               # 油猴脚本（独立运行）
│   └── verity-lens.user.js
├── server/                   # Docker 部署（可选）
│   └── fly-nas/
│       └── docker-compose.yml # 精简版 2 服务（FastAPI + Ollama）
└── docs/
    └── legal/                # 法律风险评估
```

## 🔧 技术栈

### 浏览器插件（主力）
- Chrome Extension Manifest V3
- Firefox MV2 兼容
- OpenAI 兼容接口（统一云端/Docker 调用）
- 9 家 LLM 提供商预置

### Docker（可选）
- FastAPI（OpenAI 兼容接口代理）
- Ollama + Qwen2.5-7B（本地推理）
- 冷门端口：61593（API）、63257（Ollama）

## 🤝 共享专利池

VerityLens 与 WhisperArchive 共享 **5 件专利**：

| # | 专利 | WhisperArchive | VerityLens |
|---|---|---|---|
| 1.1 | 跨模态自校验框架 | ✅ 核心 | ✅ 核心 |
| 2.2 | 心理画像生成器 | ✅ 9 类 | ⚪️ 暂不需要 |
| 3 | 跨模态假新闻检测 | ✅ 自用 | ✅ 核心 |
| 4 | 长期追踪 | ✅ 跨年 | ⚪️ 暂不需要 |
| 5 | AIGC 多模态检测 | ✅ 本地 | ✅ 防御 |

##  仓库状态

| 字段 | 值 |
|---|---|
| 仓库名 | hannanlsa/VerityLens |
| 可见性 | 🔒 PRIVATE（暂未公开） |
| 协议 | AGPL-3.0 |
| 状态 | v0.4.0（桌面助手 + CLI） |
| 创始人 | 主人（panxiao）|
| 灵感来源 | WhisperArchive |

## 🗓️ 版本计划

### v0.4.0（当前）
- ✅ 桌面助手（Tauri，macOS/Windows/Linux，< 10MB）
- ✅ CLI 工具（Python，`verity check` / `verity file` / `verity providers`）
- ✅ Rich 终端彩色输出

### v0.3.0
- ✅ 跨模态自校验核心（ASR + OCR + 文本三元组）
- ✅ Tesseract.js OCR 模块
- ✅ Web Speech ASR 模块
- ✅ 实体提取 + 跨模态实体链接
- ✅ 油猴脚本版本（Tampermonkey）
- ✅ 搜索结果图片自动 OCR 验证

### v0.2.0
- ✅ 双通道智能路由架构
- ✅ 9 家 LLM 提供商 + 免费模型引导
- ✅ 浏览器插件设置页 + 首次安装引导
- ✅ Docker 精简为 2 服务（FastAPI + Ollama）
- ✅ 智能切换：轻量→本地，复杂→云端

### v0.3.0（计划）
- ⏳ 跨模态自校验核心（ASR + OCR + 文本三元组）
- ⏳ 油猴脚本版本
- ⏳ Tesseract.js OCR 集成

### v0.4.0（计划）
- ⏳ 桌面助手（macOS / Windows / Linux）
- ⏳ CLI 工具

### v1.0.0（远期）
- ⏳ Android 端
- ⏳ 企业版
- ⏳ 商业模式 1+2 落地

## 📜 协议

- **代码**：AGPL-3.0
- **专利**：专利申请中（共享 WhisperArchive 5 件）
- **商标**：VerityLens 商标申请中
- **隐私**：本地优先 + 零数据收集 + 用户自选通道

## 🙏 致谢

灵感来源：[WhisperArchive](https://github.com/hannanlsa/WhisperArchive)
