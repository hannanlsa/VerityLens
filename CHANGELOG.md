# Changelog

All notable changes to **VerityLens** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
