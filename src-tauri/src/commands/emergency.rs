// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Emergency Broadcast Commands
//!
//! Tauri commands for configuring emergency broadcast settings.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::State;
use vauchi_core::api::EmergencyBroadcastConfig;

use crate::state::AppState;

/// Emergency config information for the frontend.
#[derive(Serialize)]
pub struct EmergencyConfigInfo {
    pub trusted_contact_ids: Vec<String>,
    pub message: String,
    pub include_location: bool,
}

/// Emergency config input from the frontend.
#[derive(Deserialize)]
pub struct EmergencyConfigInput {
    pub trusted_contact_ids: Vec<String>,
    pub message: String,
    pub include_location: bool,
}

/// Get the current emergency broadcast configuration.
#[tauri::command]
pub fn get_emergency_config(
    state: State<'_, Mutex<AppState>>,
) -> Result<Option<EmergencyConfigInfo>, String> {
    let state = state.lock().unwrap();
    let config = state
        .storage
        .load_emergency_config()
        .map_err(|e| e.to_string())?;
    Ok(config.map(|c| EmergencyConfigInfo {
        trusted_contact_ids: c.trusted_contact_ids,
        message: c.message,
        include_location: c.include_location,
    }))
}

/// Save emergency broadcast configuration.
#[tauri::command]
pub fn save_emergency_config(
    config: EmergencyConfigInput,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let state = state.lock().unwrap();
    let ec = EmergencyBroadcastConfig {
        trusted_contact_ids: config.trusted_contact_ids,
        message: config.message,
        include_location: config.include_location,
    };
    state
        .storage
        .save_emergency_config(&ec)
        .map_err(|e| e.to_string())
}

/// Delete emergency broadcast configuration.
#[tauri::command]
pub fn delete_emergency_config(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let state = state.lock().unwrap();
    state
        .storage
        .delete_emergency_config()
        .map_err(|e| e.to_string())
}
