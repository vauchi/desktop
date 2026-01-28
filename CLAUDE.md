<!-- SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me> -->
<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# CLAUDE.md - vauchi-desktop

> **Inherits**: See [CLAUDE.md](../CLAUDE.md) for project-wide rules.

Tauri desktop application with SolidJS frontend.

## Component-Specific Rules

- Tauri backend in Rust, frontend in SolidJS/TypeScript
- Depends on `vauchi-core`
- Follow Tauri security best practices

## Commands

```bash
cargo tauri dev                             # Development mode
cargo tauri build                           # Production build
cargo test -p vauchi-desktop                # Run Rust tests
npm test                                    # Run frontend tests (in ui/)
```

## Structure

- `src-tauri/` - Tauri Rust backend
- `ui/` - SolidJS frontend

## Local Development

Uses `.cargo/config.toml` to patch git dependency to local path.
Ensure `../core/vauchi-core` exists for local builds.
