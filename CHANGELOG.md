# Changelog

All notable changes to **VerityLens** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-06-22

### ⚠️ PATENT PENDING

> This release contains patent-pending technology (shared with WhisperArchive).
> Unauthorized reproduction, distribution, or public disclosure is prohibited.

### Added

#### i18n Internationalization
- **New**: `common/i18n/i18n-core.js` — VerityI18n with locale detection + storage persistence
- **New**: `common/i18n/zh-CN.json` — Chinese (Simplified) translations (65 keys)
- **New**: `common/i18n/en.json` — English translations (65 keys)
- Auto-detect browser language, fallback to zh-CN
- Persistent locale preference via chrome.storage.local

#### Browser Extension
- **New**: `content/verity-styles.css` — Extracted CSS for content script annotations
- **New**: `icons/` — Extension icons (16/32/48/128px)
- Version unified to 0.5.0 across all modules

#### Desktop Assistant (Tauri)
- **New**: `src-tauri/src/lib.rs` — Rust backend with `verify_text` and `verify_cloud` commands
- **New**: `src-tauri/src/main.rs` — Tauri entry point
- **New**: `src-tauri/build.rs` — Tauri build script
- 9 LLM providers supported in Rust backend
- Local heuristic verification via native Rust regex
- Cloud verification via reqwest async HTTP client

#### Docker Server
- **New**: `server/fly-nas/app.py` — FastAPI application (OpenAI-compatible proxy)
  - `/health` — Health check endpoint
  - `/v1/models` — Model listing
  - `/v1/chat/completions` — OpenAI-compatible chat proxy
  - `/verify` — VerityLens native verification endpoint
  - 9 LLM providers + local heuristic fallback
- **New**: `server/fly-nas/Dockerfile` — Python 3.12 slim image
- **New**: `server/fly-nas/requirements.txt` — FastAPI + uvicorn + httpx + pydantic

#### Userscript
- Updated to v0.5.0 with full 9 LLM provider support
- Added: Moonshot, MiniMax, 零一万物, 百度千帆 providers

### Changed
- All version numbers unified to 0.5.0 (CLI, desktop, userscript, Docker, manifest)
- `build.sh` updated for v0.5.0 packaging
- Docker compose version comment updated to v0.5.0

## [0.4.0] - 2026-06-20

### ⚠️ PATENT PENDING

> This release contains patent-pending technology (shared with WhisperArchive).
> Unauthorized reproduction, distribution, or public disclosure is prohibited.

### Added

#### Desktop Assistant (Tauri)
- **New**: `desktop-assistant/` — Cross-platform desktop app (macOS / Windows / Linux)
  - Tauri v2 + Vite + vanilla JS frontend
  - URL verification + text verification
  - Same channel modes: local / smart / cloud / docker
  - Same 9 LLM providers support
  - Lightweight: Tauri < 10MB vs Electron > 150MB

#### CLI Tool (Python)
- **New**: `cli/` — Command-line interface
  - `verity check "text"` — Verify text authenticity
  - `verity file path/to/file` — Verify file content
  - `verity providers` — List free LLM providers
  - Rich terminal output with color-coded results
  - Environment variable support: `VERITY_API_KEY`, `VERITY_BASE_URL`
  - Dependencies: httpx, click, rich

### Changed
- README updated with desktop + CLI sections
- Architecture diagram updated

## [0.3.0] - 2026-06-20

### ⚠️ PATENT PENDING

> This release contains patent-pending technology (shared with WhisperArchive).
> Unauthorized reproduction, distribution, or public disclosure is prohibited.

### Added

#### Cross-Modal Verification Core (Patent 1.1)
- **New**: `common/modules/cross-modal.js` — CrossModalVerifier with entity extraction + linking
  - 7 entity types: URL, email, phone, date, number, org, person
  - Cross-modal entity linking (exact match)
  - Weighted scoring: entity link score × 0.6 + text match × 0.4
  - ASR-OCR cross-consistency bonus
  - Unified timeline tracking
- **New**: `common/modules/ocr.js` — VerityOCR (Tesseract.js WASM)
  - Chinese + English mixed recognition
  - Element capture via canvas
  - Confidence scoring per block
- **New**: `common/modules/asr.js` — VerityASR (Web Speech API)
  - Real-time speech-to-text
  - Audio file transcription
  - Continuous recognition with auto-restart

#### Tampermonkey Userscript
- **New**: `userscript/verity-lens.user.js` — Full-featured userscript version
  - Same 6 search engines support
  - Same color annotation + hover popup
  - GM_xmlhttpRequest for cloud API calls
  - Menu commands: set API key, switch modes
  - Zero dependency, standalone operation

#### Content Script Enhancement
- **Updated**: `verity-injector.js` — Auto OCR on search result images
  - Detects `<img>` in results, runs Tesseract.js OCR
  - Passes OCR result to cross-modal verifier
  - Falls back gracefully if OCR unavailable

### Changed
- `verity-core.js` — v0.2.0 → v0.3.0
  - `crossValidate()` now delegates to CrossModalVerifier when available
  - `transcribeAudio()` delegates to VerityASR
  - `recognizeText()` delegates to VerityOCR
- `manifest.json` — v0.2.0 → v0.3.0
  - Added `common/modules/*.js` to content_scripts and web_accessible_resources
- `service-worker.js` / `background.js` — Version bump to v0.3.0

## [0.2.0] - 2026-06-20

### ⚠️ PATENT PENDING

> This release contains patent-pending technology (shared with WhisperArchive).
> Unauthorized reproduction, distribution, or public disclosure is prohibited.

### Changed

#### Architecture: Dual-Channel Smart Routing
- **Breaking**: Replaced Docker-first architecture with browser-extension-first
- **New**: Smart Router — lightweight tasks → local, complex tasks → cloud/Docker
- **New**: 4 channel modes: local / smart / cloud / docker
- **New**: Unified OpenAI-compatible interface for cloud and Docker

#### Browser Extension
- **New**: `verity-core.js` — Model Registry (9 providers) + Smart Router + Channel API
- **New**: `options/` — Full settings page with provider selector, free model guide, Docker config
- **New**: `welcome/` — First-install onboarding flow with free model recommendations
- **Updated**: `verity-injector.js` — Async verification via Channel.verify()
- **Updated**: `popup/` — Shows current channel mode and model info
- **Updated**: `manifest.json` — Added host_permissions for 9 LLM providers
- **Updated**: `service-worker.js` / `background.js` — Welcome page on install, stats aggregation

#### Supported LLM Providers (9 + custom)
- DeepSeek (deepseek-chat, deepseek-reasoner) — 🆓 注册送500万token
- 智谱GLM (glm-4-flash, glm-4-air) — 🆓 **永久免费**
- 通义千问 (qwen-turbo, qwen-plus) — 🆓 新用户100万token
- 硅基流动 (Qwen2.5-7B, DeepSeek-V3, Llama-3.3-70B) — 🆓 注册送2000万token
- Groq (llama-3.3-70b-versatile) — 🆓 免费速率限制
- Moonshot (moonshot-v1-8k) — 🆓 新用户送额度
- MiniMax (abab6.5s-chat) — 🆓 注册送额度
- 零一万物 (yi-lightning) — 🆓 注册送额度
- 百度千帆 (ernie-lite-8k) — 🆓 每月免费额度
- Custom (any OpenAI-compatible endpoint)

#### Docker (Simplified)
- **Removed**: PostgreSQL, Redis, Qdrant, Celery Worker, patent-sync (5 services removed)
- **Kept**: FastAPI (port 61593) + Ollama (port 63257) — 2 services only
- Cold ports remain in 49152-65535 range

### Design Decisions
- Browser extension as primary form factor (install-and-use, zero server needed)
- User-provided API keys (VerityLens never touches user data in transit)
- Free model onboarding: recommend 智谱GLM-4-Flash as zero-barrier entry
- Docker preserved as optional channel, not required
- Smart routing complexity threshold: configurable (default ≥3 → cloud)

## [0.1.0-alpha] - 2026-06-06

### Added

#### Documentation
- `README.md` — Project overview
- `LICENSE` — AGPL-3.0
- `CHANGELOG.md` — This file
- `PATENT_PENDING.md` — Patent notice

#### Project Structure
- `browser-extension/` — Chrome / Edge / Firefox extension (skeleton)
- `docs/legal/` — Legal risk assessment
- `server/` — Fly NAS deployment (7 services, now simplified in v0.2.0)

### Design Decisions
- Inspired by WhisperArchive
- Shared patent pool: 5 patents (1.1, 2.2, 3, 4, 5)
- Shared tech stack: PaddleOCR + faster-whisper + Qwen2.5
- Shared deployment: Fly NAS
- Independent repo, version, and main branch
