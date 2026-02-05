// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Help Commands
//!
//! Handles in-app help and FAQ for the desktop app.

use serde::Serialize;
use vauchi_core::help::{
    get_faq_by_id, get_faq_by_id_localized, get_faqs, get_faqs_by_category,
    get_faqs_by_category_localized, get_faqs_localized, search_faqs, search_faqs_localized,
    HelpCategory,
};
use vauchi_core::i18n::Locale;

/// FAQ item for the frontend.
#[derive(Serialize)]
pub struct FaqInfo {
    pub id: String,
    pub category: String,
    pub question: String,
    pub answer: String,
    pub related: Vec<String>,
}

/// Help category information.
#[derive(Serialize)]
pub struct HelpCategoryInfo {
    pub id: String,
    pub name: String,
}

impl From<&vauchi_core::help::FaqItem> for FaqInfo {
    fn from(faq: &vauchi_core::help::FaqItem) -> Self {
        FaqInfo {
            id: faq.id.clone(),
            category: category_to_string(faq.category),
            question: faq.question.clone(),
            answer: faq.answer.clone(),
            related: faq.related.clone(),
        }
    }
}

fn category_to_string(category: HelpCategory) -> String {
    match category {
        HelpCategory::GettingStarted => "getting-started".to_string(),
        HelpCategory::Privacy => "privacy".to_string(),
        HelpCategory::Recovery => "recovery".to_string(),
        HelpCategory::Contacts => "contacts".to_string(),
        HelpCategory::Updates => "updates".to_string(),
        HelpCategory::Features => "features".to_string(),
    }
}

fn string_to_category(s: &str) -> Option<HelpCategory> {
    match s.to_lowercase().as_str() {
        "getting-started" | "gettingstarted" => Some(HelpCategory::GettingStarted),
        "privacy" => Some(HelpCategory::Privacy),
        "recovery" => Some(HelpCategory::Recovery),
        "contacts" => Some(HelpCategory::Contacts),
        "updates" => Some(HelpCategory::Updates),
        "features" => Some(HelpCategory::Features),
        _ => None,
    }
}

/// Get all help categories.
#[tauri::command]
pub fn get_help_categories() -> Vec<HelpCategoryInfo> {
    HelpCategory::all()
        .iter()
        .map(|cat| HelpCategoryInfo {
            id: category_to_string(*cat),
            name: cat.display_name().to_string(),
        })
        .collect()
}

/// Get all FAQ items.
#[tauri::command]
pub fn get_all_faqs() -> Vec<FaqInfo> {
    get_faqs().iter().map(FaqInfo::from).collect()
}

/// Get FAQs for a specific category.
#[tauri::command]
pub fn get_category_faqs(category: String) -> Vec<FaqInfo> {
    if let Some(cat) = string_to_category(&category) {
        get_faqs_by_category(cat)
            .iter()
            .map(FaqInfo::from)
            .collect()
    } else {
        vec![]
    }
}

/// Get a specific FAQ by ID.
#[tauri::command]
pub fn get_faq(faq_id: String) -> Option<FaqInfo> {
    get_faq_by_id(&faq_id).map(|f| FaqInfo::from(&f))
}

/// Search FAQs by query.
#[tauri::command]
pub fn search_help(query: String) -> Vec<FaqInfo> {
    search_faqs(&query).iter().map(FaqInfo::from).collect()
}

fn string_to_locale(code: &str) -> Locale {
    match code.to_lowercase().as_str() {
        "de" => Locale::German,
        "fr" => Locale::French,
        "es" => Locale::Spanish,
        _ => Locale::English,
    }
}

/// Get all FAQ items in the specified locale.
#[tauri::command]
pub fn get_all_faqs_localized(locale_code: String) -> Vec<FaqInfo> {
    get_faqs_localized(string_to_locale(&locale_code))
        .iter()
        .map(FaqInfo::from)
        .collect()
}

/// Get FAQs for a specific category in the specified locale.
#[tauri::command]
pub fn get_category_faqs_localized(category: String, locale_code: String) -> Vec<FaqInfo> {
    if let Some(cat) = string_to_category(&category) {
        get_faqs_by_category_localized(cat, string_to_locale(&locale_code))
            .iter()
            .map(FaqInfo::from)
            .collect()
    } else {
        vec![]
    }
}

/// Get a specific FAQ by ID in the specified locale.
#[tauri::command]
pub fn get_faq_localized(faq_id: String, locale_code: String) -> Option<FaqInfo> {
    get_faq_by_id_localized(&faq_id, string_to_locale(&locale_code)).map(|f| FaqInfo::from(&f))
}

/// Search FAQs by query in the specified locale.
#[tauri::command]
pub fn search_help_localized(query: String, locale_code: String) -> Vec<FaqInfo> {
    search_faqs_localized(&query, string_to_locale(&locale_code))
        .iter()
        .map(FaqInfo::from)
        .collect()
}
