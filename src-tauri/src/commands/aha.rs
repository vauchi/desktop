// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Aha Moment Commands
//!
//! Tracks and triggers milestone celebrations in the desktop app.

use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use vauchi_core::aha_moments::{AhaMomentTracker, AhaMomentType};
use vauchi_core::i18n::Locale;

use crate::state::AppState;

/// Aha moment data for the frontend.
#[derive(Serialize)]
pub struct AhaMomentInfo {
    pub moment_type: String,
    pub title: String,
    pub message: String,
    pub has_animation: bool,
}

fn type_from_string(s: &str) -> Option<AhaMomentType> {
    match s {
        "card_creation_complete" => Some(AhaMomentType::CardCreationComplete),
        "first_edit" => Some(AhaMomentType::FirstEdit),
        "first_contact_added" => Some(AhaMomentType::FirstContactAdded),
        "first_update_received" => Some(AhaMomentType::FirstUpdateReceived),
        "first_outbound_delivered" => Some(AhaMomentType::FirstOutboundDelivered),
        _ => None,
    }
}

fn type_to_string(t: AhaMomentType) -> String {
    match t {
        AhaMomentType::CardCreationComplete => "card_creation_complete".to_string(),
        AhaMomentType::FirstEdit => "first_edit".to_string(),
        AhaMomentType::FirstContactAdded => "first_contact_added".to_string(),
        AhaMomentType::FirstUpdateReceived => "first_update_received".to_string(),
        AhaMomentType::FirstOutboundDelivered => "first_outbound_delivered".to_string(),
    }
}

fn string_to_locale(code: &str) -> Locale {
    match code.to_lowercase().as_str() {
        "de" => Locale::German,
        "fr" => Locale::French,
        "es" => Locale::Spanish,
        _ => Locale::English,
    }
}

fn tracker_path(data_dir: &std::path::Path) -> PathBuf {
    data_dir.join("aha_tracker.json")
}

fn load_tracker(data_dir: &std::path::Path) -> AhaMomentTracker {
    let path = tracker_path(data_dir);
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|json| AhaMomentTracker::from_json(&json).ok())
        .unwrap_or_default()
}

fn save_tracker(data_dir: &std::path::Path, tracker: &AhaMomentTracker) {
    let path = tracker_path(data_dir);
    if let Ok(json) = tracker.to_json() {
        let _ = std::fs::write(&path, json);
    }
}

/// Check and trigger an aha moment. Returns the moment if not yet seen.
#[tauri::command]
pub fn check_aha_moment(
    moment_type: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Option<AhaMomentInfo> {
    let moment = type_from_string(&moment_type)?;
    let state = state.lock().unwrap();
    let data_dir = state.data_dir().to_path_buf();
    drop(state);

    let mut tracker = load_tracker(&data_dir);
    let result = tracker.try_trigger(moment);
    if result.is_some() {
        save_tracker(&data_dir, &tracker);
    }
    result.map(|m| AhaMomentInfo {
        moment_type: type_to_string(m.moment_type),
        title: m.title().to_string(),
        message: m.message(),
        has_animation: m.has_animation(),
    })
}

/// Check and trigger an aha moment with context (e.g., contact name).
#[tauri::command]
pub fn check_aha_moment_with_context(
    moment_type: String,
    context: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Option<AhaMomentInfo> {
    let moment = type_from_string(&moment_type)?;
    let state = state.lock().unwrap();
    let data_dir = state.data_dir().to_path_buf();
    drop(state);

    let mut tracker = load_tracker(&data_dir);
    let result = tracker.try_trigger_with_context(moment, context);
    if result.is_some() {
        save_tracker(&data_dir, &tracker);
    }
    result.map(|m| AhaMomentInfo {
        moment_type: type_to_string(m.moment_type),
        title: m.title().to_string(),
        message: m.message(),
        has_animation: m.has_animation(),
    })
}

/// Check and trigger an aha moment with localized content.
#[tauri::command]
pub fn check_aha_moment_localized(
    moment_type: String,
    locale_code: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Option<AhaMomentInfo> {
    let moment = type_from_string(&moment_type)?;
    let locale = string_to_locale(&locale_code);
    let state = state.lock().unwrap();
    let data_dir = state.data_dir().to_path_buf();
    drop(state);

    let mut tracker = load_tracker(&data_dir);
    let result = tracker.try_trigger(moment);
    if result.is_some() {
        save_tracker(&data_dir, &tracker);
    }
    result.map(|m| AhaMomentInfo {
        moment_type: type_to_string(m.moment_type),
        title: m.title_localized(locale),
        message: m.message_localized(locale),
        has_animation: m.has_animation(),
    })
}

// INLINE_TEST_REQUIRED: tests access private Tauri command internals and app state setup
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn ensure_init() {
        if !vauchi_core::i18n::is_initialized() {
            let locales_dir =
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../locales");
            let _ = vauchi_core::i18n::init(&locales_dir);
        }
    }

    #[test]
    fn test_check_aha_moment_triggers_once() {
        let temp = TempDir::new().unwrap();
        let mut tracker = load_tracker(temp.path());

        // First trigger should succeed
        let moment = tracker.try_trigger(AhaMomentType::CardCreationComplete);
        assert!(moment.is_some());
        save_tracker(temp.path(), &tracker);

        // Second trigger from loaded tracker should not trigger
        let tracker2 = load_tracker(temp.path());
        assert!(tracker2.has_seen(AhaMomentType::CardCreationComplete));
    }

    #[test]
    fn test_tracker_persists() {
        let temp = TempDir::new().unwrap();
        let mut tracker = load_tracker(temp.path());
        tracker.try_trigger(AhaMomentType::FirstEdit);
        save_tracker(temp.path(), &tracker);

        let loaded = load_tracker(temp.path());
        assert!(loaded.has_seen(AhaMomentType::FirstEdit));
        assert!(!loaded.has_seen(AhaMomentType::FirstContactAdded));
    }

    #[test]
    fn test_type_roundtrip() {
        for t in AhaMomentType::all() {
            let s = type_to_string(*t);
            let back = type_from_string(&s);
            assert_eq!(back, Some(*t));
        }
    }

    #[test]
    fn test_localized_moment() {
        ensure_init();
        let temp = TempDir::new().unwrap();
        let mut tracker = load_tracker(temp.path());
        let moment = tracker
            .try_trigger(AhaMomentType::CardCreationComplete)
            .unwrap();
        let info = AhaMomentInfo {
            moment_type: type_to_string(moment.moment_type),
            title: moment.title_localized(Locale::German),
            message: moment.message_localized(Locale::German),
            has_animation: moment.has_animation(),
        };
        assert!(info.title.contains("Karte"));
    }
}
