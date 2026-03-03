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
use vauchi_core::{PendingUpdate, SymmetricKey, UpdateStatus};

use crate::error::CommandError;
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
) -> Result<Option<EmergencyConfigInfo>, CommandError> {
    let state = state.lock().unwrap();
    let config = state
        .storage
        .load_emergency_config()
        .map_err(|e| CommandError::Storage(e.to_string()))?;
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
) -> Result<(), CommandError> {
    let state = state.lock().unwrap();
    let ec = EmergencyBroadcastConfig {
        trusted_contact_ids: config.trusted_contact_ids,
        message: config.message,
        include_location: config.include_location,
    };
    state
        .storage
        .save_emergency_config(&ec)
        .map_err(|e| CommandError::Storage(e.to_string()))
}

/// Delete emergency broadcast configuration.
#[tauri::command]
pub fn delete_emergency_config(state: State<'_, Mutex<AppState>>) -> Result<(), CommandError> {
    let state = state.lock().unwrap();
    state
        .storage
        .delete_emergency_config()
        .map_err(|e| CommandError::Storage(e.to_string()))
}

/// Result of sending an emergency broadcast.
#[derive(Serialize)]
pub struct BroadcastResultInfo {
    /// Number of alerts queued for delivery.
    pub sent: usize,
    /// Total number of trusted contacts in the config.
    pub total: usize,
}

/// Send an emergency broadcast to all trusted contacts.
///
/// For each trusted contact with an established ratchet session:
/// 1. Creates an encrypted EmergencyAlert payload
/// 2. Queues it as a pending update (indistinguishable from card updates)
///
/// Returns the number of successfully queued alerts vs total contacts.
#[tauri::command]
pub fn send_emergency_broadcast(
    state: State<'_, Mutex<AppState>>,
) -> Result<BroadcastResultInfo, CommandError> {
    use vauchi_core::network::EmergencyAlert;

    let state = state.lock().unwrap();

    let config = state
        .storage
        .load_emergency_config()
        .map_err(|e| CommandError::Storage(e.to_string()))?
        .ok_or_else(|| CommandError::Emergency("Emergency broadcast not configured".to_string()))?;

    let identity = state
        .identity
        .as_ref()
        .ok_or_else(|| CommandError::Identity("No identity found".to_string()))?;

    let sender_id = identity.public_id();
    let total = config.trusted_contact_ids.len();
    let mut sent = 0;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    for contact_id in &config.trusted_contact_ids {
        // Skip contacts that don't exist locally
        let contact = match state.storage.load_contact(contact_id) {
            Ok(Some(c)) => c,
            _ => continue,
        };

        // Skip blocked contacts
        if contact.is_blocked() {
            continue;
        }

        // Skip contacts without ratchet (can't encrypt)
        let (mut ratchet, is_initiator) = match state.storage.load_ratchet_state(contact_id) {
            Ok(Some(r)) => r,
            _ => continue,
        };

        // Create the emergency alert payload
        let alert = EmergencyAlert {
            sender_id: sender_id.clone(),
            message: config.message.clone(),
            timestamp: now,
            location: None,
        };

        // Serialize the alert as JSON
        let alert_bytes = match serde_json::to_vec(&alert) {
            Ok(b) => b,
            Err(_) => continue,
        };

        // Encrypt with ratchet (indistinguishable from card update)
        let ratchet_msg = match ratchet.encrypt(&alert_bytes) {
            Ok(m) => m,
            Err(_) => continue,
        };
        let encrypted = match serde_json::to_vec(&ratchet_msg) {
            Ok(b) => b,
            Err(_) => continue,
        };

        // Save updated ratchet state
        if state
            .storage
            .save_ratchet_state(contact_id, &ratchet, is_initiator)
            .is_err()
        {
            continue;
        }

        // Generate a random ID (uses ring internally via SymmetricKey::generate)
        let update_id = hex::encode(&SymmetricKey::generate().as_bytes()[..16]);

        // Queue for delivery (looks like a regular card update on the wire)
        let update = PendingUpdate {
            id: update_id,
            contact_id: contact_id.to_string(),
            update_type: "card_delta".to_string(),
            payload: encrypted,
            created_at: now,
            retry_count: 0,
            status: UpdateStatus::Pending,
        };
        if state.storage.queue_update(&update).is_ok() {
            sent += 1;
        }
    }

    Ok(BroadcastResultInfo { sent, total })
}
