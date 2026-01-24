//! Content Update Commands
//!
//! Handles remote content update operations (networks, locales, themes, help).

use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

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
pub fn check_content_updates(state: State<'_, Mutex<AppState>>) -> Result<ContentUpdateStatus, String> {
    let state = state.lock().unwrap();

    // Get content settings
    let settings = load_content_settings(&state)?;

    if !settings.enabled {
        return Ok(ContentUpdateStatus {
            has_updates: false,
            available_updates: vec![],
            last_check: None,
            enabled: false,
            error: None,
        });
    }

    // For now, return a basic status
    // Full implementation would use ContentManager from vauchi-core
    Ok(ContentUpdateStatus {
        has_updates: false,
        available_updates: vec![],
        last_check: get_last_check_time(&state),
        enabled: true,
        error: None,
    })
}

/// Apply available content updates.
///
/// Downloads and caches any available content updates.
#[tauri::command]
pub fn apply_content_updates(state: State<'_, Mutex<AppState>>) -> Result<ContentApplyResult, String> {
    let state = state.lock().unwrap();

    // Get content settings
    let settings = load_content_settings(&state)?;

    if !settings.enabled {
        return Ok(ContentApplyResult {
            success: true,
            applied: vec![],
            failed: vec![],
            error: Some("Content updates are disabled".to_string()),
        });
    }

    // For now, return success with no updates
    // Full implementation would use ContentManager from vauchi-core
    Ok(ContentApplyResult {
        success: true,
        applied: vec![],
        failed: vec![],
        error: None,
    })
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

    std::fs::write(&config_path, json)
        .map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

/// Set the content update URL.
#[tauri::command]
pub fn set_content_url(
    state: State<'_, Mutex<AppState>>,
    url: String,
) -> Result<(), String> {
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

    std::fs::write(&config_path, json)
        .map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

/// Get the list of available social networks.
///
/// Returns networks from cache if available, otherwise bundled defaults.
#[tauri::command]
pub fn get_social_networks(_state: State<'_, Mutex<AppState>>) -> Result<Vec<SocialNetworkInfo>, String> {
    // Use bundled networks for now
    // Full implementation would use ContentManager
    Ok(get_bundled_networks())
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
        serde_json::from_str(&json)
            .map_err(|e| format!("Failed to parse settings: {}", e))
    } else {
        Ok(ContentSettings {
            enabled: true,
            content_url: "https://vauchi.app/app-files/".to_string(),
            check_interval_secs: 3600, // 1 hour
        })
    }
}

/// Get the last content check time.
fn get_last_check_time(state: &AppState) -> Option<u64> {
    let check_file = state.data_dir().join("content_last_check");
    std::fs::read_to_string(&check_file)
        .ok()
        .and_then(|s| s.trim().parse().ok())
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
