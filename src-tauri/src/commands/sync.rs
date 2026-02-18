// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Sync Commands
//!
//! Handles synchronization with the relay server using async WebSocket I/O.
//! Storage is scoped so it never lives across `.await` boundaries (it is `!Send`).

use std::sync::Mutex;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use tauri::State;
use tokio_tungstenite::tungstenite::Message;

use vauchi_core::crypto::ratchet::DoubleRatchetState;
use vauchi_core::exchange::{EncryptedExchangeMessage, X3DHKeyPair};
use vauchi_core::network::simple_message::{
    create_device_sync_ack, create_signed_handshake, create_simple_ack, create_simple_envelope,
    decode_simple_message, encode_simple_message, SimpleAckStatus, SimpleDeviceSyncMessage,
    SimpleEncryptedUpdate, SimplePayload,
};
use vauchi_core::sync::{
    build_device_sync_envelopes, process_card_updates, DeviceSyncOrchestrator, SyncItem,
};
use vauchi_core::{Contact, ContactCard, Identity, IdentityBackup, Storage};

use crate::state::AppState;

/// Type alias for the async WebSocket stream.
type WsStream = tokio_tungstenite::WebSocketStream<
    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
>;

/// Result of a sync operation.
#[derive(Serialize)]
pub struct SyncResult {
    /// Number of contacts added from exchange messages.
    pub contacts_added: u32,
    /// Number of contact cards updated.
    pub cards_updated: u32,
    /// Number of outbound updates sent.
    pub updates_sent: u32,
    /// Whether sync completed successfully.
    pub success: bool,
    /// Error message if sync failed.
    pub error: Option<String>,
}

/// Sync status for display.
#[derive(Serialize)]
pub struct SyncStatus {
    /// Number of pending outbound updates.
    pub pending_updates: u32,
    /// Last sync timestamp (Unix seconds), if available.
    pub last_sync: Option<u64>,
    /// Whether currently syncing.
    pub is_syncing: bool,
}

/// Connect to relay server via async WebSocket with timeout.
async fn connect_to_relay(relay_url: &str) -> Result<WsStream, String> {
    let (ws_stream, _) = tokio::time::timeout(
        Duration::from_secs(5),
        tokio_tungstenite::connect_async(relay_url),
    )
    .await
    .map_err(|_| "Connection timed out".to_string())?
    .map_err(|e| format!("WebSocket connection failed: {}", e))?;

    Ok(ws_stream)
}

/// Send authenticated handshake to relay.
async fn send_handshake(
    socket: &mut WsStream,
    identity: &Identity,
    device_id: Option<&str>,
) -> Result<(), String> {
    let handshake = create_signed_handshake(identity, device_id.map(|s| s.to_string()));
    let envelope = create_simple_envelope(SimplePayload::Handshake(handshake));
    let data = encode_simple_message(&envelope).map_err(|e| format!("Encode error: {}", e))?;
    socket
        .send(Message::Binary(data))
        .await
        .map_err(|e| format!("Send error: {}", e))?;
    Ok(())
}

/// Received messages from relay.
struct ReceivedMessages {
    encrypted_exchange: Vec<Vec<u8>>,
    card_updates: Vec<(String, Vec<u8>)>,
    device_sync_messages: Vec<SimpleDeviceSyncMessage>,
}

/// Receive pending messages from relay with timeout.
async fn receive_pending(socket: &mut WsStream) -> Result<ReceivedMessages, String> {
    let mut encrypted_exchange = Vec::new();
    let mut card_updates = Vec::new();
    let mut device_sync_messages = Vec::new();

    loop {
        // Use timeout to detect when no more messages are pending
        let msg = match tokio::time::timeout(Duration::from_secs(1), socket.next()).await {
            Ok(Some(Ok(msg))) => msg,
            Ok(Some(Err(_))) | Ok(None) => break,
            Err(_) => break, // Timeout — no more pending messages
        };

        match msg {
            Message::Binary(data) => {
                if let Ok(envelope) = decode_simple_message(&data) {
                    match envelope.payload {
                        SimplePayload::EncryptedUpdate(update) => {
                            // Classify the message
                            if EncryptedExchangeMessage::from_bytes(&update.ciphertext).is_ok() {
                                encrypted_exchange.push(update.ciphertext);
                            } else {
                                card_updates.push((update.sender_id, update.ciphertext));
                            }

                            // Send acknowledgment
                            let ack = create_simple_ack(
                                &envelope.message_id,
                                SimpleAckStatus::ReceivedByRecipient,
                            );
                            if let Ok(ack_data) = encode_simple_message(&ack) {
                                let _ = socket.send(Message::Binary(ack_data)).await;
                            }
                        }
                        SimplePayload::DeviceSyncMessage(msg) => {
                            // Get version before moving msg
                            let version = msg.version;
                            device_sync_messages.push(msg);

                            // Send device sync ack
                            let ack = create_device_sync_ack(&envelope.message_id, version);
                            if let Ok(ack_data) = encode_simple_message(&ack) {
                                let _ = socket.send(Message::Binary(ack_data)).await;
                            }
                        }
                        _ => {}
                    }
                }
            }
            Message::Ping(data) => {
                let _ = socket.send(Message::Pong(data)).await;
            }
            Message::Close(_) => break,
            _ => { /* Ignore other message types */ }
        }
    }

    Ok(ReceivedMessages {
        encrypted_exchange,
        card_updates,
        device_sync_messages,
    })
}

/// Process encrypted exchange messages (sync — no await, Storage-safe).
/// Returns the number of contacts added and a list of (recipient_id, exchange_key)
/// to send responses to later (without holding Storage).
fn process_exchanges_sync(
    identity: &Identity,
    storage: &Storage,
    encrypted_data: Vec<Vec<u8>>,
) -> Result<(u32, Vec<(String, [u8; 32])>), String> {
    let mut added = 0u32;
    let mut responses = Vec::new();
    let our_x3dh = identity.x3dh_keypair();

    for data in encrypted_data {
        let encrypted_msg = match EncryptedExchangeMessage::from_bytes(&data) {
            Ok(msg) => msg,
            Err(_) => continue,
        };

        let (payload, shared_secret) = match encrypted_msg.decrypt(&our_x3dh) {
            Ok(result) => result,
            Err(_) => continue,
        };

        let public_id = hex::encode(payload.identity_key);

        // Check if contact exists
        if storage
            .load_contact(&public_id)
            .map_err(|e| e.to_string())?
            .is_some()
        {
            continue;
        }

        // Create contact
        let card = ContactCard::new(&payload.display_name);
        let contact = Contact::from_exchange(payload.identity_key, card, shared_secret.clone());
        let contact_id = contact.id().to_string();
        storage.save_contact(&contact).map_err(|e| e.to_string())?;

        // Initialize ratchet
        let ratchet_dh = X3DHKeyPair::from_bytes(our_x3dh.secret_bytes());
        let ratchet = DoubleRatchetState::initialize_responder(&shared_secret, ratchet_dh);
        let _ = storage.save_ratchet_state(&contact_id, &ratchet, false);

        added += 1;
        responses.push((public_id, payload.exchange_key));
    }

    Ok((added, responses))
}

/// Send exchange response via a new async connection.
async fn send_exchange_response(
    identity: &Identity,
    recipient_id: &str,
    recipient_exchange_key: &[u8; 32],
    relay_url: &str,
) -> Result<(), String> {
    let mut socket = connect_to_relay(relay_url).await?;

    send_handshake(&mut socket, identity, None).await?;

    let our_id = identity.public_id();
    let our_x3dh = identity.x3dh_keypair();
    let (encrypted_msg, _) = EncryptedExchangeMessage::create(
        &our_x3dh,
        recipient_exchange_key,
        identity.signing_public_key(),
        identity.display_name(),
    )
    .map_err(|e| format!("Failed to encrypt exchange: {:?}", e))?;

    let update = SimpleEncryptedUpdate {
        recipient_id: recipient_id.to_string(),
        sender_id: our_id,
        ciphertext: encrypted_msg.to_bytes(),
    };

    let envelope = create_simple_envelope(SimplePayload::EncryptedUpdate(update));
    let data = encode_simple_message(&envelope).map_err(|e| e.to_string())?;
    socket
        .send(Message::Binary(data))
        .await
        .map_err(|e| e.to_string())?;

    tokio::time::sleep(Duration::from_millis(100)).await;
    let _ = socket.close(None).await;

    Ok(())
}

// Card update processing is now handled by vauchi_core::sync::process_card_updates
// which provides the full secure pipeline (revocation, signature, replay detection).

/// Collect pending outbound updates as serialized envelopes (sync — no await, Storage-safe).
/// Returns (update_id, serialized_envelope) pairs for async sending.
fn collect_pending_updates_data(
    identity: &Identity,
    storage: &Storage,
) -> Result<Vec<(String, Vec<u8>)>, String> {
    let contacts = storage.list_contacts().map_err(|e| e.to_string())?;
    let our_id = identity.public_id();
    let mut result = Vec::new();

    for contact in contacts {
        let pending = storage
            .get_pending_updates(contact.id())
            .map_err(|e| e.to_string())?;

        for update in pending {
            let msg = SimpleEncryptedUpdate {
                recipient_id: contact.id().to_string(),
                sender_id: our_id.clone(),
                ciphertext: update.payload,
            };

            let envelope = create_simple_envelope(SimplePayload::EncryptedUpdate(msg));
            if let Ok(data) = encode_simple_message(&envelope) {
                result.push((update.id, data));
            }
        }
    }

    Ok(result)
}

/// Process incoming device sync messages from other devices.
fn process_device_sync_messages(
    identity: &Identity,
    storage: &Storage,
    messages: Vec<SimpleDeviceSyncMessage>,
) -> Result<u32, String> {
    if messages.is_empty() {
        return Ok(0);
    }

    // Try to load device registry - if none exists, skip
    let registry = match storage.load_device_registry() {
        Ok(Some(r)) if r.device_count() > 1 => r,
        _ => return Ok(0),
    };

    let mut orchestrator =
        DeviceSyncOrchestrator::new(storage, identity.create_device_info(), registry.clone());

    let mut processed = 0u32;

    for msg in messages {
        // Parse sender device ID
        let sender_device_id: [u8; 32] = match hex::decode(&msg.sender_device_id) {
            Ok(bytes) if bytes.len() == 32 => {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&bytes);
                arr
            }
            _ => continue,
        };

        // Find sender in registry
        let sender_device = match registry.find_device(&sender_device_id) {
            Some(d) => d,
            None => continue,
        };

        // Decrypt payload
        let plaintext = match orchestrator
            .decrypt_from_device(&sender_device.exchange_public_key, &msg.encrypted_payload)
        {
            Ok(pt) => pt,
            Err(_) => continue,
        };

        // Parse SyncItems
        let items: Vec<SyncItem> = match serde_json::from_slice(&plaintext) {
            Ok(items) => items,
            Err(_) => continue,
        };

        // Process items with conflict resolution
        let applied = match orchestrator.process_incoming(items) {
            Ok(applied) => applied,
            Err(_) => continue,
        };

        // Apply the items
        for item in &applied {
            let _ = apply_sync_item(storage, item);
        }

        if !applied.is_empty() {
            processed += 1;
        }
    }

    Ok(processed)
}

/// Apply a single sync item to local storage.
fn apply_sync_item(storage: &Storage, item: &SyncItem) -> Result<(), String> {
    match item {
        SyncItem::ContactAdded { contact_data, .. } => {
            if let Ok(contact) = contact_data.to_contact() {
                storage.save_contact(&contact).map_err(|e| e.to_string())?;
            }
        }
        SyncItem::ContactRemoved { contact_id, .. } => {
            storage
                .delete_contact(contact_id)
                .map_err(|e| e.to_string())?;
        }
        SyncItem::CardUpdated {
            field_label,
            new_value,
            ..
        } => {
            if let Ok(Some(mut card)) = storage.load_own_card() {
                if card.update_field_value(field_label, new_value).is_ok() {
                    storage.save_own_card(&card).map_err(|e| e.to_string())?;
                }
            }
        }
        SyncItem::VisibilityChanged {
            contact_id,
            field_label,
            is_visible,
            ..
        } => {
            if let Some(mut contact) = storage
                .load_contact(contact_id)
                .map_err(|e| e.to_string())?
            {
                if *is_visible {
                    contact.visibility_rules_mut().set_everyone(field_label);
                } else {
                    contact.visibility_rules_mut().set_nobody(field_label);
                }
                storage.save_contact(&contact).map_err(|e| e.to_string())?;
            }
        }
        SyncItem::LabelChange { .. } => {
            // Label changes are handled by the label manager during full sync
        }
        _ => {
            // Unknown sync items are silently ignored for forward compatibility
        }
    }
    Ok(())
}

/// Perform a fully async sync with the relay server.
///
/// Storage is created in scoped blocks and dropped before any `.await` boundaries
/// because `Storage` is `!Send` (contains `RefCell`).
async fn do_sync_async(
    data_dir: &std::path::Path,
    relay_url: &str,
    backup_password: &str,
) -> Result<SyncResult, String> {
    // ── Phase 1: Reconstruct identity (Storage scoped, no await) ──
    let (identity, device_id_hex) = {
        let storage = AppState::open_storage(data_dir).map_err(|e| e.to_string())?;
        let (backup_data, _name) = storage
            .load_identity()
            .map_err(|e| e.to_string())?
            .ok_or("No identity found in storage")?;
        let backup = IdentityBackup::new(backup_data);
        let identity = Identity::import_backup(&backup, backup_password)
            .map_err(|e| format!("Failed to import identity: {:?}", e))?;
        let device_id_hex = hex::encode(identity.device_id());
        (identity, device_id_hex)
        // storage dropped here
    };

    // ── Phase 2: Connect and receive messages (async, no Storage) ──
    let mut socket = connect_to_relay(relay_url).await?;
    send_handshake(&mut socket, &identity, Some(&device_id_hex)).await?;
    tokio::time::sleep(Duration::from_millis(100)).await;
    let received = receive_pending(&mut socket).await?;

    // ── Phase 3: Process received messages (Storage scoped, no await) ──
    let (contacts_added, exchange_responses, cards_updated, device_synced, device_envelopes, pending_to_send) = {
        let storage = AppState::open_storage(data_dir).map_err(|e| e.to_string())?;

        // Process exchange messages
        let (added, responses) =
            process_exchanges_sync(&identity, &storage, received.encrypted_exchange)?;

        // Process card updates (core's secure pipeline)
        let card_result = process_card_updates(&identity, &storage, received.card_updates)
            .map_err(|e| e.to_string())?;

        // Process device sync messages
        let device_synced =
            process_device_sync_messages(&identity, &storage, received.device_sync_messages)?;

        // Build device sync envelopes for outbound
        let device_envelopes =
            build_device_sync_envelopes(&identity, &storage).unwrap_or_default();

        // Collect pending update data
        let pending = collect_pending_updates_data(&identity, &storage)?;

        (
            added,
            responses,
            card_result.processed,
            device_synced,
            device_envelopes,
            pending,
        )
        // storage dropped here
    };

    // ── Phase 4: Send outbound data (async, no Storage) ──

    // Send exchange responses (each opens its own connection)
    for (recipient_id, exchange_key) in &exchange_responses {
        let _ = send_exchange_response(&identity, recipient_id, exchange_key, relay_url).await;
    }

    // Send device sync envelopes
    let mut device_sent = 0u32;
    for data in device_envelopes {
        if socket.send(Message::Binary(data)).await.is_ok() {
            device_sent += 1;
        }
    }

    // Send pending updates and track which ones succeeded
    let mut updates_sent = 0u32;
    let mut sent_ids = Vec::new();
    for (update_id, data) in pending_to_send {
        if socket.send(Message::Binary(data)).await.is_ok() {
            sent_ids.push(update_id);
            updates_sent += 1;
        }
    }

    // ── Phase 5: Cleanup sent updates (Storage scoped, no await) ──
    if !sent_ids.is_empty() {
        let storage = AppState::open_storage(data_dir).map_err(|e| e.to_string())?;
        for id in &sent_ids {
            let _ = storage.delete_pending_update(id);
        }
        // storage dropped here
    }

    let _ = socket.close(None).await;

    Ok(SyncResult {
        contacts_added,
        cards_updated: cards_updated + device_synced,
        updates_sent: updates_sent + device_sent,
        success: true,
        error: None,
    })
}

/// Perform a sync with the relay server.
///
/// This sends pending updates to contacts and receives incoming updates.
/// Fully async — no blocking I/O on the Tauri command thread.
#[tauri::command]
pub async fn sync(state: State<'_, Mutex<AppState>>) -> Result<SyncResult, String> {
    // Extract what we need from state (hold lock briefly, then release)
    let (data_dir, relay_url, backup_password) = {
        let state_guard = state.lock().unwrap();

        if state_guard.identity.is_none() {
            return Err("No identity found. Please create an identity first.".to_string());
        }

        let backup_password = state_guard.backup_password().map_err(|e| e.to_string())?;

        (
            state_guard.data_dir().to_path_buf(),
            state_guard.relay_url().to_string(),
            backup_password,
        )
    };
    // Mutex lock released here — UI thread is now unblocked

    // Run fully async sync (no spawn_blocking needed)
    do_sync_async(&data_dir, &relay_url, &backup_password).await
}

/// Get the current sync status.
#[tauri::command]
pub fn get_sync_status(state: State<'_, Mutex<AppState>>) -> Result<SyncStatus, String> {
    let state = state.lock().unwrap();

    if state.identity.is_none() {
        return Ok(SyncStatus {
            pending_updates: 0,
            last_sync: None,
            is_syncing: false,
        });
    }

    // Count pending updates across all contacts
    let contacts = state
        .storage
        .list_contacts()
        .map_err(|e| format!("Failed to list contacts: {:?}", e))?;

    let mut total_pending = 0u32;
    for contact in &contacts {
        let pending = state
            .storage
            .get_pending_updates(contact.id())
            .unwrap_or_default();
        total_pending += pending.len() as u32;
    }

    Ok(SyncStatus {
        pending_updates: total_pending,
        last_sync: None,
        is_syncing: false,
    })
}

/// Get the current relay URL.
#[tauri::command]
pub fn get_relay_url(state: State<'_, Mutex<AppState>>) -> Result<String, String> {
    let state = state.lock().unwrap();
    Ok(state.relay_url().to_string())
}

/// Set the relay URL.
#[tauri::command]
pub fn set_relay_url(state: State<'_, Mutex<AppState>>, url: String) -> Result<(), String> {
    let mut state = state.lock().unwrap();
    state.set_relay_url(&url).map_err(|e| e.to_string())
}
