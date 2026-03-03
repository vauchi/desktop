// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Duress PIN Commands
//!
//! Tauri commands for enabling, disabling, and testing duress PIN authentication.
//! Duress mode allows the user to enter a secondary PIN that signals coercion
//! while appearing to unlock the app normally.

use std::sync::Mutex;

use serde::Serialize;
use tauri::State;
use vauchi_core::AuthResult;

use crate::error::CommandError;
use crate::state::AppState;

/// Result of duress auth test.
#[derive(Serialize)]
pub struct AuthTestResult {
    /// The authentication mode detected: "normal", "duress", or "invalid".
    pub mode: String,
}

/// Enable duress PIN by providing the normal app password and the desired duress PIN.
///
/// The normal password is verified first to prevent unauthorized changes.
/// The duress PIN must differ from the normal password.
#[tauri::command]
pub fn enable_duress_password(
    password: String,
    duress_password: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), CommandError> {
    let state = state.lock().unwrap();

    // Load existing password config
    let mut config = state
        .storage
        .load_password_config()
        .map_err(|e| CommandError::Storage(e.to_string()))?
        .ok_or_else(|| {
            CommandError::Auth("App password not configured. Set it up first.".to_string())
        })?;

    // Verify the normal password before allowing duress setup
    match config.verify(&password) {
        AuthResult::Normal => {} // Password is correct, proceed
        AuthResult::Duress => {
            return Err(CommandError::Auth(
                "Cannot use duress PIN to modify duress settings".to_string(),
            ));
        }
        AuthResult::Invalid => {
            return Err(CommandError::Auth("Incorrect password".to_string()));
        }
    }

    // Set up the duress PIN
    config
        .setup_duress(&duress_password)
        .map_err(|e| CommandError::Auth(e.to_string()))?;

    // Persist the duress hash and salt
    state
        .storage
        .save_duress_password(config.duress_hash().unwrap(), config.duress_salt().unwrap())
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    Ok(())
}

/// Get the current duress configuration status.
///
/// Returns whether an app password is set and whether duress mode is enabled.
#[tauri::command]
pub fn get_duress_config(
    state: State<'_, Mutex<AppState>>,
) -> Result<DuressConfigInfo, CommandError> {
    let state = state.lock().unwrap();

    let config = state
        .storage
        .load_password_config()
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    Ok(DuressConfigInfo {
        password_enabled: config.is_some(),
        duress_enabled: config.map(|c| c.duress_enabled()).unwrap_or(false),
    })
}

/// Duress configuration status for the frontend.
#[derive(Serialize)]
pub struct DuressConfigInfo {
    /// Whether an app password is configured.
    pub password_enabled: bool,
    /// Whether duress mode is enabled.
    pub duress_enabled: bool,
}

/// Disable the duress PIN.
///
/// Requires the normal password for authorization.
#[tauri::command]
pub fn disable_duress_password(
    password: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), CommandError> {
    let state = state.lock().unwrap();

    // Load existing password config
    let config = state
        .storage
        .load_password_config()
        .map_err(|e| CommandError::Storage(e.to_string()))?
        .ok_or_else(|| CommandError::Auth("No app password configured".to_string()))?;

    // Verify the normal password
    match config.verify(&password) {
        AuthResult::Normal => {} // Password is correct, proceed
        AuthResult::Duress => {
            return Err(CommandError::Auth(
                "Cannot use duress PIN to disable duress".to_string(),
            ));
        }
        AuthResult::Invalid => {
            return Err(CommandError::Auth("Incorrect password".to_string()));
        }
    }

    // Disable duress
    state
        .storage
        .disable_duress()
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    // Also clean up duress settings
    let _ = state.storage.delete_duress_settings();

    Ok(())
}

/// Test authentication to detect which mode a given password/PIN triggers.
///
/// Returns "normal", "duress", or "invalid" without triggering any
/// duress alerts. Useful for verifying the duress PIN works correctly
/// during setup.
#[tauri::command]
pub fn test_duress_auth(
    password: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<AuthTestResult, CommandError> {
    let state = state.lock().unwrap();

    let config = state
        .storage
        .load_password_config()
        .map_err(|e| CommandError::Storage(e.to_string()))?
        .ok_or_else(|| CommandError::Auth("No app password configured".to_string()))?;

    let mode = match config.verify(&password) {
        AuthResult::Normal => "normal",
        AuthResult::Duress => "duress",
        AuthResult::Invalid => "invalid",
    };

    Ok(AuthTestResult {
        mode: mode.to_string(),
    })
}
