// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Authentication & Duress PIN Commands

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::State;
use vauchi_core::{AppPasswordConfig, AuthMode, AuthResult, DuressSettings};

use crate::error::CommandError;
use crate::state::AppState;

/// Duress status information for the frontend.
#[derive(Serialize)]
pub struct DuressStatus {
    pub password_enabled: bool,
    pub duress_enabled: bool,
}

/// Duress settings for the frontend.
#[derive(Serialize)]
pub struct DuressSettingsInfo {
    pub alert_contact_ids: Vec<String>,
    pub alert_message: String,
    pub include_location: bool,
}

/// Input for saving duress settings.
#[derive(Deserialize)]
pub struct DuressSettingsInput {
    pub alert_contact_ids: Vec<String>,
    pub alert_message: String,
    pub include_location: bool,
}

/// Get the current authentication mode.
///
/// Returns "normal", "duress", or "unauthenticated".
#[tauri::command]
pub fn get_auth_mode(state: State<'_, Mutex<AppState>>) -> String {
    let state = state.lock().unwrap();
    match state.auth_mode {
        AuthMode::Normal => "normal".to_string(),
        AuthMode::Duress => "duress".to_string(),
        AuthMode::Unauthenticated => "unauthenticated".to_string(),
    }
}

/// Set up app password.
#[tauri::command]
pub fn setup_app_password(
    password: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), CommandError> {
    let state = state.lock().unwrap();

    let config =
        AppPasswordConfig::create(&password).map_err(|e| CommandError::Auth(e.to_string()))?;
    state
        .storage
        .save_app_password(config.password_hash(), config.password_salt())
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    Ok(())
}

/// Verify a password/PIN and return the auth result.
///
/// Sets the auth mode on the app state so that subsequent API calls
/// (e.g. `list_contacts`) return the correct data for the mode.
#[tauri::command]
pub fn authenticate(
    pin: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, CommandError> {
    let mut state = state.lock().unwrap();

    let config = state
        .storage
        .load_password_config()
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    match config {
        Some(config) => match config.verify(&pin) {
            AuthResult::Normal => {
                state.auth_mode = AuthMode::Normal;
                Ok("normal".to_string())
            }
            AuthResult::Duress => {
                state.auth_mode = AuthMode::Duress;
                // Queue encrypted duress alerts for trusted contacts (silent, best-effort).
                // Failures are logged but do not block authentication.
                if let Err(e) = state.queue_duress_alerts() {
                    eprintln!("Warning: Failed to queue duress alerts: {}", e);
                }
                Ok("duress".to_string())
            }
            AuthResult::Invalid => Ok("invalid".to_string()),
        },
        None => Err(CommandError::Auth("No app password configured".to_string())),
    }
}

/// Set up duress PIN (requires app password to already be set).
#[tauri::command]
pub fn setup_duress_pin(
    duress_pin: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), CommandError> {
    let state = state.lock().unwrap();

    let mut config = state
        .storage
        .load_password_config()
        .map_err(|e| CommandError::Storage(e.to_string()))?
        .ok_or_else(|| CommandError::Auth("App password not set. Set it up first.".to_string()))?;

    config
        .setup_duress(&duress_pin)
        .map_err(|e| CommandError::Auth(e.to_string()))?;

    state
        .storage
        .save_duress_password(config.duress_hash().unwrap(), config.duress_salt().unwrap())
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    Ok(())
}

/// Disable duress PIN.
#[tauri::command]
pub fn disable_duress(state: State<'_, Mutex<AppState>>) -> Result<(), CommandError> {
    let state = state.lock().unwrap();

    state
        .storage
        .disable_duress()
        .map_err(|e| CommandError::Storage(e.to_string()))?;
    let _ = state.storage.delete_duress_settings();

    Ok(())
}

/// Get duress status (password enabled, duress enabled).
#[tauri::command]
pub fn get_duress_status(state: State<'_, Mutex<AppState>>) -> Result<DuressStatus, CommandError> {
    let state = state.lock().unwrap();

    let config = state
        .storage
        .load_password_config()
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    Ok(DuressStatus {
        password_enabled: config.is_some(),
        duress_enabled: config.map(|c| c.duress_enabled()).unwrap_or(false),
    })
}

/// Get duress alert settings.
#[tauri::command]
pub fn get_duress_settings(
    state: State<'_, Mutex<AppState>>,
) -> Result<Option<DuressSettingsInfo>, CommandError> {
    let state = state.lock().unwrap();

    let settings = state
        .storage
        .load_duress_settings()
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    Ok(settings.map(|s| DuressSettingsInfo {
        alert_contact_ids: s.alert_contact_ids,
        alert_message: s.alert_message,
        include_location: s.include_location,
    }))
}

/// Save duress alert settings.
#[tauri::command]
pub fn save_duress_settings(
    settings: DuressSettingsInput,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), CommandError> {
    let state = state.lock().unwrap();

    let duress_settings = DuressSettings {
        alert_contact_ids: settings.alert_contact_ids,
        alert_message: settings.alert_message,
        include_location: settings.include_location,
    };

    state
        .storage
        .save_duress_settings(&duress_settings)
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    Ok(())
}
