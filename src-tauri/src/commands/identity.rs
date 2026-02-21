// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Identity Commands

use std::sync::Mutex;

use serde::Serialize;
use tauri::State;

use crate::error::CommandError;
use crate::state::AppState;

/// Identity information for the frontend.
#[derive(Serialize)]
pub struct IdentityInfo {
    pub display_name: String,
    pub public_id: String,
}

/// Check if an identity exists.
#[tauri::command]
pub fn has_identity(state: State<'_, Mutex<AppState>>) -> bool {
    let state = state.lock().unwrap();
    state.has_identity()
}

/// Create a new identity.
#[tauri::command]
pub fn create_identity(
    name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<IdentityInfo, CommandError> {
    let mut state = state.lock().unwrap();

    state
        .create_identity(&name)
        .map_err(|e| CommandError::Identity(e.to_string()))?;

    Ok(IdentityInfo {
        display_name: state.display_name().unwrap_or("").to_string(),
        public_id: state.public_id().unwrap_or_default(),
    })
}

/// Get identity information.
#[tauri::command]
pub fn get_identity_info(state: State<'_, Mutex<AppState>>) -> Result<IdentityInfo, CommandError> {
    let state = state.lock().unwrap();

    if !state.has_identity() {
        return Err(CommandError::Identity("No identity found".to_string()));
    }

    Ok(IdentityInfo {
        display_name: state.display_name().unwrap_or("").to_string(),
        public_id: state.public_id().unwrap_or_default(),
    })
}

/// Update display name.
#[tauri::command]
pub fn update_display_name(
    name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<IdentityInfo, CommandError> {
    let mut state = state.lock().unwrap();

    state
        .update_display_name(&name)
        .map_err(|e| CommandError::Identity(e.to_string()))?;

    Ok(IdentityInfo {
        display_name: state.display_name().unwrap_or("").to_string(),
        public_id: state.public_id().unwrap_or_default(),
    })
}
