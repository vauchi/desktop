// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! GDPR Commands
//!
//! Privacy compliance operations for the desktop app.

use std::sync::Mutex;

use serde::Serialize;
use tauri::State;

use crate::state::AppState;

/// Deletion state information for the frontend.
#[derive(Serialize)]
pub struct DeletionInfo {
    pub state: String,
    pub scheduled_at: u64,
    pub execute_at: u64,
    pub days_remaining: u32,
}

/// Consent record for the frontend.
#[derive(Serialize)]
pub struct ConsentRecordInfo {
    pub id: String,
    pub consent_type: String,
    pub granted: bool,
    pub timestamp: u64,
    pub policy_version: Option<String>,
}

/// Export all user data as GDPR-compliant JSON.
#[tauri::command]
pub fn export_gdpr_data(state: State<'_, Mutex<AppState>>) -> Result<String, String> {
    let state = state.lock().unwrap();
    let export = vauchi_core::api::export_all_data(&state.storage)
        .map_err(|e| format!("Export failed: {}", e))?;

    serde_json::to_string_pretty(&export).map_err(|e| format!("Serialization failed: {}", e))
}

/// Schedule account deletion with 7-day grace period.
#[tauri::command]
pub fn schedule_account_deletion(
    state: State<'_, Mutex<AppState>>,
) -> Result<DeletionInfo, String> {
    let state = state.lock().unwrap();
    let mut manager = vauchi_core::api::DeletionManager::new(&state.storage);

    manager
        .schedule_deletion()
        .map_err(|e| format!("Schedule failed: {}", e))?;

    let deletion_state = manager
        .deletion_state()
        .map_err(|e| format!("Failed to get state: {}", e))?;

    Ok(deletion_state_to_info(&deletion_state))
}

/// Cancel a scheduled account deletion.
#[tauri::command]
pub fn cancel_account_deletion(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let state = state.lock().unwrap();
    let mut manager = vauchi_core::api::DeletionManager::new(&state.storage);
    manager
        .cancel_deletion()
        .map_err(|e| format!("Cancel failed: {}", e))
}

/// Get current deletion state.
#[tauri::command]
pub fn get_deletion_state(state: State<'_, Mutex<AppState>>) -> Result<DeletionInfo, String> {
    let state = state.lock().unwrap();
    let manager = vauchi_core::api::DeletionManager::new(&state.storage);
    let deletion_state = manager
        .deletion_state()
        .map_err(|e| format!("Failed to get state: {}", e))?;

    Ok(deletion_state_to_info(&deletion_state))
}

/// Grant consent for a specific type.
#[tauri::command]
pub fn grant_consent(
    consent_type: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let state = state.lock().unwrap();
    let ct = parse_consent_type(&consent_type)?;
    let manager = vauchi_core::api::ConsentManager::new(&state.storage);
    manager
        .grant(ct)
        .map_err(|e| format!("Grant failed: {}", e))
}

/// Revoke consent for a specific type.
#[tauri::command]
pub fn revoke_consent(
    consent_type: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let state = state.lock().unwrap();
    let ct = parse_consent_type(&consent_type)?;
    let manager = vauchi_core::api::ConsentManager::new(&state.storage);
    manager
        .revoke(ct)
        .map_err(|e| format!("Revoke failed: {}", e))
}

/// Get all consent records.
#[tauri::command]
pub fn get_consent_records(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<ConsentRecordInfo>, String> {
    let state = state.lock().unwrap();
    let manager = vauchi_core::api::ConsentManager::new(&state.storage);
    let records = manager
        .export_consent_log_with_version()
        .map_err(|e| format!("Failed to get records: {}", e))?;

    Ok(records
        .iter()
        .map(|r| ConsentRecordInfo {
            id: r.id.clone(),
            consent_type: format!("{:?}", r.consent_type),
            granted: r.granted,
            timestamp: r.timestamp,
            policy_version: r.policy_version.clone(),
        })
        .collect())
}

fn deletion_state_to_info(state: &vauchi_core::storage::DeletionState) -> DeletionInfo {
    match state {
        vauchi_core::storage::DeletionState::None => DeletionInfo {
            state: "none".to_string(),
            scheduled_at: 0,
            execute_at: 0,
            days_remaining: 0,
        },
        vauchi_core::storage::DeletionState::Scheduled {
            scheduled_at,
            execute_at,
        } => {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let remaining = execute_at.saturating_sub(now);
            DeletionInfo {
                state: "scheduled".to_string(),
                scheduled_at: *scheduled_at,
                execute_at: *execute_at,
                days_remaining: (remaining / 86400) as u32,
            }
        }
        vauchi_core::storage::DeletionState::Executed { .. } => DeletionInfo {
            state: "executed".to_string(),
            scheduled_at: 0,
            execute_at: 0,
            days_remaining: 0,
        },
    }
}

fn parse_consent_type(s: &str) -> Result<vauchi_core::api::ConsentType, String> {
    vauchi_core::api::ConsentType::parse(s).ok_or_else(|| {
        format!(
            "Unknown consent type: '{}'. Valid: data_processing, contact_sharing, analytics, recovery_vouching",
            s
        )
    })
}
