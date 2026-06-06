# Changelog

All notable changes to **VerityLens** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-alpha] - 2026-06-06

### ⚠️ PATENT PENDING

> This release contains patent-pending technology (shared with WhisperArchive).
> Unauthorized reproduction, distribution, or public disclosure is prohibited.

### Added

#### Documentation
- `README.md` — Project overview
- `LICENSE` — AGPL-3.0
- `CHANGELOG.md` — This file
- `PATENT_PENDING.md` — Patent notice

#### Project Structure
- `browser-extension/` — Chrome / Edge / Firefox extension (skeleton)
- `desktop-assistant/` — macOS / Windows / Linux desktop app (planned)
- `userscript/` — Tampermonkey userscript (planned)
- `cli/` — Command line tool (planned)
- `docs/legal/` — Legal risk assessment
- `docs/architecture/` — Architecture documentation
- `server/` — Fly NAS deployment (optional)

### Design Decisions
- Inspired by WhisperArchive
- Shared patent pool: 5 patents (1.1, 2.2, 3, 4, 5)
- Shared tech stack: PaddleOCR + faster-whisper + Qwen2.5
- Shared deployment: Fly NAS
- Independent repo, version, and main branch
