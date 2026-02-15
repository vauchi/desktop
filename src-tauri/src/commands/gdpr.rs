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
    let manager = vauchi_core::api::DeletionManager::new(&state.storage);

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
    let manager = vauchi_core::api::DeletionManager::new(&state.storage);
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

/// Shred report information for the frontend.
#[derive(Serialize)]
pub struct ShredReportInfo {
    pub contacts_notified: usize,
    pub relay_purge_sent: bool,
    pub smk_destroyed: bool,
    pub sqlite_destroyed: bool,
    pub all_clear: bool,
}

/// Creates a SecureStorage instance for shred operations.
#[allow(unused_variables)]
fn create_secure_storage(
    data_dir: &std::path::Path,
) -> Result<Box<dyn vauchi_core::storage::secure::SecureStorage>, String> {
    #[cfg(feature = "secure-storage")]
    {
        Ok(Box::new(
            vauchi_core::storage::secure::PlatformKeyring::new("vauchi-desktop"),
        ))
    }

    #[cfg(not(feature = "secure-storage"))]
    {
        let fallback_key = crate::state::load_or_generate_fallback_key(data_dir)
            .map_err(|e| format!("Failed to load fallback key: {}", e))?;
        let key_dir = data_dir.join("keys");
        Ok(Box::new(vauchi_core::storage::secure::FileKeyStorage::new(
            key_dir,
            fallback_key,
        )))
    }
}

/// Creates a connected RelayClient for shred operations.
fn create_shred_relay_client(
    relay_url: &str,
    identity_id: &str,
) -> Result<vauchi_core::network::RelayClient<vauchi_core::network::WebSocketTransport>, String> {
    use vauchi_core::network::{
        RelayClient, RelayClientConfig, TransportConfig, WebSocketTransport,
    };
    let transport_config = TransportConfig {
        server_url: relay_url.to_string(),
        ..TransportConfig::default()
    };
    let config = RelayClientConfig {
        transport: transport_config,
        ..RelayClientConfig::default()
    };
    let transport = WebSocketTransport::new();
    let mut client = RelayClient::new(transport, config, identity_id.to_string());
    client
        .connect()
        .map_err(|e| format!("Failed to connect to relay: {}", e))?;
    Ok(client)
}

/// Execute a scheduled account deletion after the grace period.
#[tauri::command]
pub fn execute_account_deletion(
    state: State<'_, Mutex<AppState>>,
) -> Result<ShredReportInfo, String> {
    let state = state.lock().unwrap();
    let identity = state.identity.as_ref().ok_or("No identity loaded")?;

    let manager = vauchi_core::api::DeletionManager::new(&state.storage);
    let deletion_state = manager
        .deletion_state()
        .map_err(|e| format!("Failed to get deletion state: {}", e))?;

    let token = match deletion_state {
        vauchi_core::storage::DeletionState::Scheduled {
            scheduled_at,
            execute_at,
        } => {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            if now < execute_at {
                return Err("Grace period has not elapsed yet".to_string());
            }
            vauchi_core::api::ShredToken::from_created_at(scheduled_at)
        }
        vauchi_core::storage::DeletionState::None => {
            return Err("No deletion scheduled".to_string());
        }
        vauchi_core::storage::DeletionState::Executed { .. } => {
            return Err("Account already deleted".to_string());
        }
    };

    let secure_storage =
        create_secure_storage(state.data_dir()).map_err(|e| format!("Secure storage: {}", e))?;
    let identity_id = hex::encode(identity.signing_public_key());
    let shred_manager = vauchi_core::api::ShredManager::new(
        &state.storage,
        secure_storage.as_ref(),
        identity,
        state.data_dir(),
    );

    let mut purge_client = create_shred_relay_client(state.relay_url(), &identity_id)?;
    let mut revocation_client = create_shred_relay_client(state.relay_url(), &identity_id)?;

    let report = shred_manager
        .hard_shred(token, Some(&mut purge_client), Some(&mut revocation_client))
        .map_err(|e| format!("Shred failed: {}", e))?;

    let verification = shred_manager.verify_shred();

    Ok(ShredReportInfo {
        contacts_notified: report.contacts_notified,
        relay_purge_sent: report.relay_purge_sent,
        smk_destroyed: report.smk_destroyed,
        sqlite_destroyed: report.sqlite_destroyed,
        all_clear: verification.all_clear,
    })
}

/// Emergency immediate deletion — no grace period.
#[tauri::command]
pub fn panic_shred(state: State<'_, Mutex<AppState>>) -> Result<ShredReportInfo, String> {
    let state = state.lock().unwrap();
    let identity = state.identity.as_ref().ok_or("No identity loaded")?;

    let secure_storage =
        create_secure_storage(state.data_dir()).map_err(|e| format!("Secure storage: {}", e))?;
    let identity_id = hex::encode(identity.signing_public_key());
    let shred_manager = vauchi_core::api::ShredManager::new(
        &state.storage,
        secure_storage.as_ref(),
        identity,
        state.data_dir(),
    );

    // Best-effort relay connections
    let mut purge_client = create_shred_relay_client(state.relay_url(), &identity_id).ok();
    let mut revocation_client = create_shred_relay_client(state.relay_url(), &identity_id).ok();

    let report = shred_manager
        .panic_shred(
            purge_client
                .as_mut()
                .map(|c| c as &mut dyn vauchi_core::api::PurgeSender),
            revocation_client
                .as_mut()
                .map(|c| c as &mut dyn vauchi_core::api::RevocationSender),
        )
        .map_err(|e| format!("Panic shred failed: {}", e))?;

    let verification = shred_manager.verify_shred();

    Ok(ShredReportInfo {
        contacts_notified: report.contacts_notified,
        relay_purge_sent: report.relay_purge_sent,
        smk_destroyed: report.smk_destroyed,
        sqlite_destroyed: report.sqlite_destroyed,
        all_clear: verification.all_clear,
    })
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
