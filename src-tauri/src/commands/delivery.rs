// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Delivery Commands (SP-12b)
//!
//! Exposes delivery status, record listing, retry processing, cleanup,
//! and failure message translation to the frontend.

use std::sync::Mutex;

use serde::Serialize;
use tauri::State;

use vauchi_core::delivery::{ConnectivityDiagnostics, DeliveryService, RetryScheduler};
use vauchi_core::storage::DeliveryStatus;

use crate::error::CommandError;
use crate::state::AppState;

/// Delivery status summary for the frontend.
#[derive(Debug, Serialize)]
pub struct DeliveryStatusSummary {
    /// Number of queued deliveries.
    pub queued: usize,
    /// Number of sent deliveries.
    pub sent: usize,
    /// Number of stored deliveries.
    pub stored: usize,
    /// Number of delivered messages.
    pub delivered: usize,
    /// Number of failed deliveries.
    pub failed: usize,
    /// Number of pending retries.
    pub pending_retries: usize,
    /// Offline queue depth.
    pub offline_queue_depth: usize,
}

/// A delivery record for display in the frontend.
#[derive(Debug, Serialize)]
pub struct DeliveryRecordInfo {
    /// Message identifier.
    pub message_id: String,
    /// Recipient identifier.
    pub recipient_id: String,
    /// Current status string.
    pub status: String,
    /// Failure reason (if status is "failed").
    pub reason: Option<String>,
    /// Creation timestamp (Unix seconds).
    pub created_at: u64,
    /// Last update timestamp (Unix seconds).
    pub updated_at: u64,
}

/// Result of a retry processing tick.
#[derive(Debug, Serialize)]
pub struct RetryResult {
    /// Number of due entries found.
    pub due: usize,
    /// Number rescheduled.
    pub rescheduled: usize,
    /// Number expired (max attempts exceeded).
    pub expired: usize,
}

/// Result of a cleanup operation.
#[derive(Debug, Serialize)]
pub struct CleanupResult {
    /// Number of records marked expired.
    pub expired: usize,
    /// Number of old records removed.
    pub cleaned_up: usize,
}

/// Get delivery status summary with counts by status.
#[tauri::command]
pub fn get_delivery_status(
    state: State<'_, Mutex<AppState>>,
) -> Result<DeliveryStatusSummary, CommandError> {
    let state = state.lock().unwrap();
    let storage = &state.storage;

    let queued = storage.count_deliveries_by_status(&DeliveryStatus::Queued)?;
    let sent = storage.count_deliveries_by_status(&DeliveryStatus::Sent)?;
    let stored = storage.count_deliveries_by_status(&DeliveryStatus::Stored)?;
    let delivered = storage.count_deliveries_by_status(&DeliveryStatus::Delivered)?;
    let failed = storage.count_deliveries_by_status(&DeliveryStatus::Failed {
        reason: String::new(),
    })?;

    let diagnostics = ConnectivityDiagnostics::new();
    let report = diagnostics
        .run()
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    Ok(DeliveryStatusSummary {
        queued,
        sent,
        stored,
        delivered,
        failed,
        pending_retries: report.pending_retries as usize,
        offline_queue_depth: report.offline_queue_depth as usize,
    })
}

/// List delivery records, optionally filtered by status.
#[tauri::command]
pub fn list_delivery_records(
    state: State<'_, Mutex<AppState>>,
    filter: Option<String>,
) -> Result<Vec<DeliveryRecordInfo>, CommandError> {
    let state = state.lock().unwrap();
    let storage = &state.storage;

    let records = match filter.as_deref() {
        Some("failed") => storage.get_delivery_records_by_status(&DeliveryStatus::Failed {
            reason: String::new(),
        })?,
        Some("pending") => storage.get_pending_deliveries()?,
        Some("queued") => storage.get_delivery_records_by_status(&DeliveryStatus::Queued)?,
        Some("delivered") => storage.get_delivery_records_by_status(&DeliveryStatus::Delivered)?,
        _ => storage.get_all_delivery_records()?,
    };

    Ok(records
        .into_iter()
        .map(|r| {
            let (status, reason) = format_status(&r.status);
            DeliveryRecordInfo {
                message_id: r.message_id,
                recipient_id: r.recipient_id,
                status,
                reason,
                created_at: r.created_at,
                updated_at: r.updated_at,
            }
        })
        .collect())
}

/// Process due delivery retries.
#[tauri::command]
pub fn process_delivery_retries(
    state: State<'_, Mutex<AppState>>,
) -> Result<RetryResult, CommandError> {
    let state = state.lock().unwrap();
    let scheduler = RetryScheduler::new();
    let result = scheduler.tick(&state.storage)?;

    Ok(RetryResult {
        due: result.due,
        rescheduled: result.rescheduled,
        expired: result.expired,
    })
}

/// Run delivery cleanup (expire old records, remove terminal records).
#[tauri::command]
pub fn run_delivery_cleanup(
    state: State<'_, Mutex<AppState>>,
) -> Result<CleanupResult, CommandError> {
    let state = state.lock().unwrap();
    let service = DeliveryService::new();
    let result = service.run_cleanup(&state.storage)?;

    Ok(CleanupResult {
        expired: result.expired,
        cleaned_up: result.cleaned_up,
    })
}

/// Translate a delivery failure reason to a user-friendly message.
#[tauri::command]
pub fn translate_delivery_failure(reason: String) -> Result<String, CommandError> {
    Ok(vauchi_core::delivery::failure_to_user_message(&reason))
}

/// Format a DeliveryStatus to (status_string, optional_reason).
fn format_status(status: &DeliveryStatus) -> (String, Option<String>) {
    match status {
        DeliveryStatus::Queued => ("queued".to_string(), None),
        DeliveryStatus::Sent => ("sent".to_string(), None),
        DeliveryStatus::Stored => ("stored".to_string(), None),
        DeliveryStatus::Delivered => ("delivered".to_string(), None),
        DeliveryStatus::Expired => ("expired".to_string(), None),
        DeliveryStatus::Failed { reason } => ("failed".to_string(), Some(reason.clone())),
    }
}
