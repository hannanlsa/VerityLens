# VerityLens（真实透镜）

> 🛡️ 跨模态自校验 × 反虚假信息助手
> A cross-modal fact-checking assistant for the post-truth era.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Status: v0.1.0-alpha](https://img.shields.io/badge/Status-v0.1.0--alpha-orange)](CHANGELOG.md)
[![Patent: Pending](https://img.shields.io/badge/Patent-Pending-red)](PATENT_PENDING.md)

## ✨ 项目定位

**VerityLens = 真实透镜**

- 🎯 核心 = 帮用户在搜索结果中识别广告 / SEO / 真实内容
- 🛡️ 特性 = **跨模态自校验**（ASR + OCR + 文本三元组）
- 🌍 形态 = 浏览器插件 + 桌面助手 + 油猴脚本 + CLI
- 🔒 原则 = **本地优先 + 隐私保护 + 自用场景**
- 🆓 开源 = AGPL-3.0 协议 + **永不商业化** = 永久免费

## 🎯 为什么需要 VerityLens？

**国产搜索现状**（2024 调研）：
- 百度：广告 20-30% + 真实内容 40-50%（最差）
- 360：广告 15-25% + 真实内容 50-60%（中等）
- 搜狗：广告 15-20% + 真实内容 50-60%（较好）
- **Google**：广告 5-10% + 真实内容 70-80%（最佳）

**用户痛点**：
- 真正需要的内容被广告 / SEO 农场 / 软文淹没
- 找不到真正的官方文档 / 学术资源 / 真实信息
- 浪费时间在虚假内容上

## 🚀 核心功能

### 1. 跨模态自校验（v0.1.0-alpha）
- ASR（语音）+ OCR（屏幕）+ 文本三元组
- 5 级置信度（high / medium / abnormal / partial_X / unverified）
- 跨模态实体链接
- 统一时间轴

### 2. 搜索结果真实性标注（v0.2.0 计划）
- 浏览器插件（Chrome / Edge / Firefox）
- 桌面助手（类似 360 助手起家）
- 油猴脚本（Tampermonkey）
- CLI 工具

### 3. 颜色标注 + 真实性评分
- 绿 = 真实（官方 / 学术 / 可信）
- 黄 = 中性（个人博客 / 中等可信）
- 红 = 广告 / SEO 农场 / 软文

### 4. "是否需要跳转到真正网址？"提示
- 弹出 hover 框显示真实性评分
- 提供"跳转到真正网址"按钮

## 🏗️ 架构

```
verity-lens/
├── browser-extension/    # 浏览器插件（Chrome / Edge / Firefox）
├── desktop-assistant/    # 桌面助手（macOS / Windows / Linux）
├── userscript/           # 油猴脚本（跨平台）
├── cli/                  # 命令行工具
├── docs/
│   ├── architecture/     # 架构文档
│   ├── api/              # API 文档
│   ├── legal/            # 法律风险评估
│   └── tutorials/        # 5 大 ROM + 5 大平台教程
├── server/               # 飞牛 NAS 部署（可选）
│   ├── api/              # FastAPI 后端
│   ├── workers/          # Celery 任务队列
│   └── models/           # ML 模型
└── android-shell/        # Android 端（未来）
```

## 🔧 技术栈

### 共享自 WhisperArchive
- PaddleOCR 3.6.0（OCR）
- faster-whisper 1.2.1（ASR）
- Qwen2.5-7B（LLM）
- FastAPI 0.136.3（API）
- Celery 5.6.3（任务队列）
- PostgreSQL 16（数据库）
- Qdrant 1.18.0（向量库）

### VerityLens 特有
- Playwright（浏览器自动化）
- JSDOM（DOM 解析）
- Chrome Extension Manifest V3

## 🤝 共享专利池

VerityLens 与 WhisperArchive 共享 **5 件专利**：

| # | 专利 | WhisperArchive | VerityLens |
|---|---|---|---|
| 1.1 | 跨模态自校验框架 | ✅ 核心 | ✅ 核心 |
| 2.2 | 心理画像生成器 | ✅ 9 类 | ⚪️ 暂不需要 |
| 3 | 跨模态假新闻检测 | ✅ 自用 | ✅ 核心 |
| 4 | 长期追踪 | ✅ 跨年 | ⚪️ 暂不需要 |
| 5 | AIGC 多模态检测 | ✅ 本地 | ✅ 防御 |

**共享技术栈**：
- ✅ PaddleOCR
- ✅ faster-whisper
- ✅ Qwen2.5

**共享部署**：
- ✅ 飞牛 NAS

**共享原则**：
- ✅ 本地优先
- ✅ 隐私保护
- ✅ 自用场景

**不共享**：
- ❌ 仓库（独立 GitHub repo）
- ❌ 版本号（独立 v0.x.x）
- ❌ 主分支（独立 main / develop）

## 💰 商业模式（重要）

**主人 15:12 疑问**：
> "如果这个项目做出成品，免费的（安卓/Windows/mac/Linux 等，如何才能赚钱呢？）"

**答案**：

### ❌ 直接收费 = 不可能
- 开源 + 免费 = 主人原意
- 商业收费 = 违背初心

### ✅ 间接收入（5 大模式）

#### 模式 1：GitHub Sponsor / Open Collective
- 主人 GitHub: hannanlsa
- 月度赞助：$5-100/月 × 100-1000 人 = $500-100k/月
- **不限制** = 用户自愿

#### 模式 2：技术咨询 / 二次开发
- 企业用户定制：¥5-50k/单
- 技术支持年费：¥1-10k/年/企业
- **按需收费** = 不影响开源

#### 模式 3：周边产品
- 主题 / 皮肤 / Logo 周边
- T 恤 / 马克杯 / 贴纸
- 限量版（NFT 不考虑）
- **可选** = 用户自愿

#### 模式 4：知识付费
- 在线课程（B 站 / 慕课）
- 技术书籍（人民邮电出版社）
- 直播打赏
- **不限制** = 用户自愿

#### 模式 5：开源生态分成
- 云厂商分成（AWS / 阿里云 / 腾讯云）
- 插件市场分成（Chrome Web Store）
- 应用商店分成
- **平台决定** = 不影响开源

### 我的建议：**以"模式 1 + 模式 2"为主**
- 模式 1 = GitHub Sponsor = 长期稳定
- 模式 2 = 技术咨询 = 短期高利润
- 模式 3-5 = 可选 = 不强制

## 📦 仓库状态

| 字段 | 值 |
|---|---|
| 仓库名 | hannanlsa/VerityLens |
| 可见性 | 🔒 PRIVATE（暂未公开） |
| 协议 | AGPL-3.0 |
| 状态 | v0.1.0-alpha（框架搭建） |
| 创始人 | 主人（panxiao）|
| 灵感来源 | WhisperArchive |

## 🗓️ 版本计划

### v0.1.0-alpha（当前）
- ✅ 仓库框架
- ✅ README + 法律风险评估
- ⏳ 浏览器插件骨架（Chrome MV3）

### v0.2.0（计划）
- ⏳ 跨模态自校验核心
- ⏳ 油猴脚本版本
- ⏳ 颜色标注 + 真实性评分

### v0.3.0（计划）
- ⏳ 桌面助手（macOS / Windows / Linux）
- ⏳ CLI 工具
- ⏳ 飞牛 NAS 部署

### v1.0.0（远期）
- ⏳ Android 端
- ⏳ 企业版
- ⏳ 商业模式 1+2 落地

## 🤝 贡献

主人是唯一维护者，欢迎：
- ⭐ Star 关注
- 🐛 Issue 反馈
- 🔀 PR 贡献
- 💰 Sponsor 赞助

## 📞 联系

- GitHub: @hannanlsa
- 邮箱: panxiao@example.com（待主人提供）
- 主页: https://hannanlsa.github.io/VerityLens（待主人创建）

## 📜 协议

- **代码**：AGPL-3.0
- **专利**：专利申请中（共享 WhisperArchive 5 件）
- **商标**：VerityLens 商标申请中
- **隐私**：本地优先 + 零数据收集

## 🙏 致谢

灵感来源：[WhisperArchive](https://github.com/hannanlsa/WhisperArchive)
