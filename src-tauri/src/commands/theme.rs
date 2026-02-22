// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Theme Commands
//!
//! Handles theme management for the desktop app.

use serde::Serialize;
use vauchi_core::theme::{load_themes_from_json, Theme, ThemeColors, ThemeMode};

/// Themes embedded at compile time from the themes repo.
const THEMES_JSON: &[u8] = include_bytes!("../../../../themes/themes.json");

/// Theme information for the frontend.
#[derive(Serialize)]
pub struct ThemeInfo {
    pub id: String,
    pub name: String,
    pub mode: String,
    pub author: Option<String>,
    pub colors: ThemeColorsInfo,
}

/// Theme colors for the frontend.
#[derive(Serialize)]
pub struct ThemeColorsInfo {
    pub bg_primary: String,
    pub bg_secondary: String,
    pub bg_tertiary: String,
    pub text_primary: String,
    pub text_secondary: String,
    pub accent: String,
    pub accent_dark: String,
    pub success: String,
    pub error: String,
    pub warning: String,
    pub border: String,
}

impl From<&Theme> for ThemeInfo {
    fn from(theme: &Theme) -> Self {
        ThemeInfo {
            id: theme.id.clone(),
            name: theme.name.clone(),
            mode: match theme.mode {
                ThemeMode::Light => "light".to_string(),
                ThemeMode::Dark => "dark".to_string(),
            },
            author: theme.author.clone(),
            colors: ThemeColorsInfo::from(&theme.colors),
        }
    }
}

impl From<&ThemeColors> for ThemeColorsInfo {
    fn from(colors: &ThemeColors) -> Self {
        ThemeColorsInfo {
            bg_primary: colors.bg_primary.clone(),
            bg_secondary: colors.bg_secondary.clone(),
            bg_tertiary: colors.bg_tertiary.clone(),
            text_primary: colors.text_primary.clone(),
            text_secondary: colors.text_secondary.clone(),
            accent: colors.accent.clone(),
            accent_dark: colors.accent_dark.clone(),
            success: colors.success.clone(),
            error: colors.error.clone(),
            warning: colors.warning.clone(),
            border: colors.border.clone(),
        }
    }
}

fn load_themes() -> Vec<Theme> {
    load_themes_from_json(THEMES_JSON).unwrap_or_default()
}

/// Get all available themes.
#[tauri::command]
pub fn get_available_themes() -> Vec<ThemeInfo> {
    load_themes().iter().map(ThemeInfo::from).collect()
}

/// Get a specific theme by ID.
#[tauri::command]
pub fn get_theme(theme_id: String) -> Option<ThemeInfo> {
    load_themes()
        .iter()
        .find(|t| t.id == theme_id)
        .map(ThemeInfo::from)
}

/// Get the default theme ID based on system preference.
#[tauri::command]
pub fn get_default_theme_id(prefer_dark: bool) -> String {
    if prefer_dark {
        "default-dark".to_string()
    } else {
        "default-light".to_string()
    }
}
