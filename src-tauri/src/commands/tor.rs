// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Tor Privacy Mode Commands
//!
//! Tauri commands for configuring Tor connectivity settings.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::state::AppState;

/// Tor config information for the frontend.
#[derive(Serialize)]
pub struct TorConfigInfo {
    pub enabled: bool,
    pub bridges: Vec<String>,
    pub prefer_onion: bool,
    pub circuit_rotation_secs: u64,
}

/// Tor config input from the frontend.
#[derive(Deserialize)]
pub struct TorConfigInput {
    pub enabled: bool,
    pub bridges: Vec<String>,
    pub prefer_onion: bool,
    pub circuit_rotation_secs: u64,
}

/// Get the current Tor configuration.
#[tauri::command]
pub fn get_tor_config(
    state: State<'_, Mutex<AppState>>,
) -> Result<TorConfigInfo, String> {
    let state = state.lock().unwrap();
    let config = state
        .storage
        .load_or_create_tor_config()
        .map_err(|e| e.to_string())?;
    Ok(TorConfigInfo {
        enabled: config.enabled,
        bridges: config.bridges,
        prefer_onion: config.prefer_onion,
        circuit_rotation_secs: config.circuit_rotation_secs,
    })
}

/// Save Tor configuration.
#[tauri::command]
pub fn save_tor_config(
    config: TorConfigInput,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let state = state.lock().unwrap();
    let tc = vauchi_core::TorConfig {
        enabled: config.enabled,
        bridges: config.bridges,
        prefer_onion: config.prefer_onion,
        circuit_rotation_secs: config.circuit_rotation_secs,
    };
    state
        .storage
        .save_tor_config(&tc)
        .map_err(|e| e.to_string())
}
