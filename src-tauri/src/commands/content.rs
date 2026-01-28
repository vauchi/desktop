// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Content Update Commands
//!
//! Handles remote content update operations (networks, locales, themes, help).

use serde::Serialize;
use std::sync::Mutex;
use tauri::State;
use vauchi_core::content::{ApplyResult, ContentConfig, ContentManager, ContentType, UpdateStatus};

use crate::state::AppState;

/// Status of a content update check.
#[derive(Serialize)]
pub struct ContentUpdateStatus {
    /// Whether updates are available.
    pub has_updates: bool,
    /// Content types with available updates.
    pub available_updates: Vec<String>,
    /// Last check time (Unix timestamp).
    pub last_check: Option<u64>,
    /// Whether remote updates are enabled.
    pub enabled: bool,
    /// Error message if check failed.
    pub error: Option<String>,
}

/// Result of applying content updates.
#[derive(Serialize)]
pub struct ContentApplyResult {
    /// Whether the operation succeeded.
    pub success: bool,
    /// Content types successfully updated.
    pub applied: Vec<String>,
    /// Content types that failed to update.
    pub failed: Vec<String>,
    /// Error message if operation failed.
    pub error: Option<String>,
}

/// Settings for content updates.
#[derive(Serialize)]
pub struct ContentSettings {
    /// Whether remote content updates are enabled.
    pub enabled: bool,
    /// Content update URL.
    pub content_url: String,
    /// Check interval in seconds.
    pub check_interval_secs: u64,
}

/// Check for available content updates.
///
/// Returns information about which content types have updates available.
#[tauri::command]
pub async fn check_content_updates(
    state: State<'_, Mutex<AppState>>,
) -> Result<ContentUpdateStatus, String> {
    let (settings, data_dir) = {
        let state = state.lock().unwrap();
        let settings = load_content_settings(&state)?;
        let data_dir = state.data_dir().to_path_buf();
        (settings, data_dir)
    };

    if !settings.enabled {
        return Ok(ContentUpdateStatus {
            has_updates: false,
            available_updates: vec![],
            last_check: None,
            enabled: false,
            error: None,
        });
    }

    // Create ContentManager with the storage path
    let config = ContentConfig {
        storage_path: data_dir.clone(),
        remote_updates_enabled: true,
        ..Default::default()
    };

    let manager = ContentManager::new(config)
        .map_err(|e| format!("Failed to create content manager: {}", e))?;

    // Check for updates
    let status = manager.check_for_updates().await;

    // Update last check time
    let check_file = data_dir.join("content_last_check");
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let _ = std::fs::write(&check_file, timestamp.to_string());

    match status {
        UpdateStatus::UpToDate => Ok(ContentUpdateStatus {
            has_updates: false,
            available_updates: vec![],
            last_check: Some(timestamp),
            enabled: true,
            error: None,
        }),
        UpdateStatus::UpdatesAvailable(types) => Ok(ContentUpdateStatus {
            has_updates: true,
            available_updates: types.into_iter().map(content_type_name).collect(),
            last_check: Some(timestamp),
            enabled: true,
            error: None,
        }),
        UpdateStatus::Disabled => Ok(ContentUpdateStatus {
            has_updates: false,
            available_updates: vec![],
            last_check: Some(timestamp),
            enabled: false,
            error: None,
        }),
        UpdateStatus::CheckFailed(e) => Ok(ContentUpdateStatus {
            has_updates: false,
            available_updates: vec![],
            last_check: Some(timestamp),
            enabled: true,
            error: Some(e),
        }),
    }
}

/// Convert content type to display name.
fn content_type_name(ct: ContentType) -> String {
    match ct {
        ContentType::Networks => "networks".to_string(),
        ContentType::Locales => "locales".to_string(),
        ContentType::Themes => "themes".to_string(),
        ContentType::Help => "help".to_string(),
    }
}

/// Apply available content updates.
///
/// Downloads and caches any available content updates.
#[tauri::command]
pub async fn apply_content_updates(
    state: State<'_, Mutex<AppState>>,
) -> Result<ContentApplyResult, String> {
    let (settings, data_dir) = {
        let state = state.lock().unwrap();
        let settings = load_content_settings(&state)?;
        let data_dir = state.data_dir().to_path_buf();
        (settings, data_dir)
    };

    if !settings.enabled {
        return Ok(ContentApplyResult {
            success: true,
            applied: vec![],
            failed: vec![],
            error: Some("Content updates are disabled".to_string()),
        });
    }

    // Create ContentManager with the storage path
    let config = ContentConfig {
        storage_path: data_dir,
        remote_updates_enabled: true,
        ..Default::default()
    };

    let manager = ContentManager::new(config)
        .map_err(|e| format!("Failed to create content manager: {}", e))?;

    // Apply updates
    match manager.apply_updates().await {
        Ok(result) => match result {
            ApplyResult::NoUpdates => Ok(ContentApplyResult {
                success: true,
                applied: vec![],
                failed: vec![],
                error: None,
            }),
            ApplyResult::Disabled => Ok(ContentApplyResult {
                success: true,
                applied: vec![],
                failed: vec![],
                error: Some("Content updates are disabled".to_string()),
            }),
            ApplyResult::Applied { applied, failed } => Ok(ContentApplyResult {
                success: failed.is_empty(),
                applied: applied.into_iter().map(content_type_name).collect(),
                failed: failed
                    .into_iter()
                    .map(|(ct, err)| format!("{}: {}", content_type_name(ct), err))
                    .collect(),
                error: None,
            }),
        },
        Err(e) => Ok(ContentApplyResult {
            success: false,
            applied: vec![],
            failed: vec![],
            error: Some(e.to_string()),
        }),
    }
}

/// Get current content update settings.
#[tauri::command]
pub fn get_content_settings(state: State<'_, Mutex<AppState>>) -> Result<ContentSettings, String> {
    let state = state.lock().unwrap();
    load_content_settings(&state)
}

/// Enable or disable remote content updates.
#[tauri::command]
pub fn set_content_updates_enabled(
    state: State<'_, Mutex<AppState>>,
    enabled: bool,
) -> Result<(), String> {
    let state = state.lock().unwrap();
    let config_path = state.data_dir().join("content_settings.json");

    let mut settings = load_content_settings(&state)?;
    settings.enabled = enabled;

    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    std::fs::write(&config_path, json).map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

/// Set the content update URL.
#[tauri::command]
pub fn set_content_url(state: State<'_, Mutex<AppState>>, url: String) -> Result<(), String> {
    let url = url.trim();
    if url.is_empty() {
        return Err("Content URL cannot be empty".to_string());
    }
    if !url.starts_with("https://") {
        return Err("Content URL must use HTTPS".to_string());
    }

    let state = state.lock().unwrap();
    let config_path = state.data_dir().join("content_settings.json");

    let mut settings = load_content_settings(&state)?;
    settings.content_url = url.to_string();

    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    std::fs::write(&config_path, json).map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

/// Get the list of available social networks.
///
/// Returns networks from cache if available, otherwise bundled defaults.
#[tauri::command]
pub fn get_social_networks(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<SocialNetworkInfo>, String> {
    let data_dir = {
        let state = state.lock().unwrap();
        state.data_dir().to_path_buf()
    };

    // Create ContentManager to get networks
    let config = ContentConfig {
        storage_path: data_dir,
        remote_updates_enabled: true,
        ..Default::default()
    };

    match ContentManager::new(config) {
        Ok(manager) => {
            let networks = manager.networks();
            Ok(networks
                .into_iter()
                .map(|n| SocialNetworkInfo {
                    id: n.id,
                    name: n.name,
                    url_template: n.url,
                })
                .collect())
        }
        Err(_) => {
            // Fall back to bundled networks
            Ok(get_bundled_networks())
        }
    }
}

/// Information about a social network.
#[derive(Serialize)]
pub struct SocialNetworkInfo {
    /// Unique identifier.
    pub id: String,
    /// Display name.
    pub name: String,
    /// Profile URL template.
    pub url_template: String,
}

// === Helper Functions ===

/// Load content settings from disk.
fn load_content_settings(state: &AppState) -> Result<ContentSettings, String> {
    let config_path = state.data_dir().join("content_settings.json");

    if config_path.exists() {
        let json = std::fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read settings: {}", e))?;
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse settings: {}", e))
    } else {
        Ok(ContentSettings {
            enabled: true,
            content_url: "https://vauchi.app/app-files/".to_string(),
            check_interval_secs: 3600, // 1 hour
        })
    }
}

/// Get bundled social networks.
fn get_bundled_networks() -> Vec<SocialNetworkInfo> {
    vec![
        SocialNetworkInfo {
            id: "twitter".to_string(),
            name: "Twitter / X".to_string(),
            url_template: "https://twitter.com/{username}".to_string(),
        },
        SocialNetworkInfo {
            id: "instagram".to_string(),
            name: "Instagram".to_string(),
            url_template: "https://instagram.com/{username}".to_string(),
        },
        SocialNetworkInfo {
            id: "github".to_string(),
            name: "GitHub".to_string(),
            url_template: "https://github.com/{username}".to_string(),
        },
        SocialNetworkInfo {
            id: "linkedin".to_string(),
            name: "LinkedIn".to_string(),
            url_template: "https://linkedin.com/in/{username}".to_string(),
        },
        SocialNetworkInfo {
            id: "mastodon".to_string(),
            name: "Mastodon".to_string(),
            url_template: "https://mastodon.social/@{username}".to_string(),
        },
        SocialNetworkInfo {
            id: "bluesky".to_string(),
            name: "Bluesky".to_string(),
            url_template: "https://bsky.app/profile/{username}".to_string(),
        },
        SocialNetworkInfo {
            id: "threads".to_string(),
            name: "Threads".to_string(),
            url_template: "https://threads.net/@{username}".to_string(),
        },
    ]
}

// Implement Serialize for ContentSettings (needed for JSON serialization)
impl<'de> serde::Deserialize<'de> for ContentSettings {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(serde::Deserialize)]
        struct ContentSettingsHelper {
            enabled: bool,
            content_url: String,
            check_interval_secs: u64,
        }

        let helper = ContentSettingsHelper::deserialize(deserializer)?;
        Ok(ContentSettings {
            enabled: helper.enabled,
            content_url: helper.content_url,
            check_interval_secs: helper.check_interval_secs,
        })
    }
}
