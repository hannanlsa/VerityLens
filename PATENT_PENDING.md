# PATENT PENDING NOTICE

> This repository contains patent-pending technology.
> Unauthorized reproduction, distribution, or public disclosure is prohibited.

## Status

| Field | Value |
|-------|-------|
| **Patent Application** | In preparation (expected 2026 Q3) |
| **Repository Visibility** | 🔒 PRIVATE |
| **Shared Patents** | 5 patents shared with WhisperArchive (1.1, 2.2, 3, 4, 5) |
| **Technology Areas** | Cross-modal fact-checking, source verification, search result authenticity scoring |

## Technology Disclosure

### 1. Cross-Modal Triple Verification (核心)
- ASR (speech) + OCR (screen text) + textual content cross-validation
- 5-level confidence scoring (high / medium / abnormal / partial_X / unverified)
- Unified timeline + entity universe cross-referencing
- **Adapted from WhisperArchive 1.1 patent**

### 2. Search Result Authenticity Scoring
- DOM injection (no scraping)
- 3-tier color coding (green / yellow / red)
- Hover popup with authenticity score
- "Jump to real source" prompt
- **New: VerityLens-specific algorithm**

### 3. Sub-Components (extensible verification)
- Browser extension (Chrome MV3)
- Desktop assistant (Electron / Tauri)
- Userscript (Tampermonkey)
- CLI tool (Rust / Python)

## Permitted Use

This patent-pending technology is **restricted to the following personal use cases only**:

1. **本人搜索质量提升** (Owner's search quality improvement)
2. **反虚假信息** (Anti-misinformation)
3. **开源社区贡献** (Open source community contribution)

**NOT PERMITTED** for:
- ❌ Commercial use
- ❌ Gray-area use (unauthorized data collection, surveillance)
- ❌ Manipulating search results

## Shared Patent Pool (与 WhisperArchive)

VerityLens 共享 WhisperArchive 的 5 件专利：

| # | 专利 | VerityLens 用途 |
|---|---|---|
| 1.1 | 跨模态自校验框架 | ✅ 核心 |
| 2.2 | 心理画像生成器 | ⚪️ 暂不需要 |
| 3 | 跨模态假新闻检测 | ✅ 核心 |
| 4 | 长期追踪 | ⚪️ 暂不需要 |
| 5 | AIGC 多模态检测 | ✅ 防御 |

