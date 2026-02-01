// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Internationalization Commands
//!
//! Handles localization for the desktop app.

use serde::Serialize;
use std::collections::HashMap;
use vauchi_core::i18n::{
    get_all_strings, get_available_locales, get_locale_info, get_string, get_string_with_args,
    Locale,
};

/// Locale information for the frontend.
#[derive(Serialize)]
pub struct LocaleInfo {
    pub code: String,
    pub name: String,
    pub english_name: String,
    pub is_rtl: bool,
}

/// Get all available locales.
#[tauri::command]
pub fn get_locales() -> Vec<LocaleInfo> {
    get_available_locales()
        .into_iter()
        .map(|locale| {
            let info = get_locale_info(locale);
            LocaleInfo {
                code: info.code.to_string(),
                name: info.name.to_string(),
                english_name: info.english_name.to_string(),
                is_rtl: info.is_rtl,
            }
        })
        .collect()
}

/// Get a localized string.
#[tauri::command]
pub fn get_localized_string(locale_code: String, key: String) -> String {
    let locale = parse_locale(&locale_code);
    get_string(locale, &key)
}

/// Get a localized string with arguments.
#[tauri::command]
pub fn get_localized_string_with_args(
    locale_code: String,
    key: String,
    args: HashMap<String, String>,
) -> String {
    let locale = parse_locale(&locale_code);
    let args_vec: Vec<(&str, &str)> = args.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();
    get_string_with_args(locale, &key, &args_vec)
}

/// Get all localized strings for a locale.
#[tauri::command]
pub fn get_locale_strings(locale_code: String) -> HashMap<String, String> {
    let locale = parse_locale(&locale_code);
    get_all_strings(locale)
}

/// Parse a locale code to a Locale enum.
fn parse_locale(code: &str) -> Locale {
    Locale::from_code(code).unwrap_or(Locale::English)
}
