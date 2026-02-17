// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Sync Commands
//!
//! Handles synchronization with the relay server.

use std::net::TcpStream;
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::State;
use tungstenite::stream::MaybeTlsStream;
use tungstenite::{Message, WebSocket};

use vauchi_core::crypto::ratchet::DoubleRatchetState;
use vauchi_core::exchange::{EncryptedExchangeMessage, X3DHKeyPair};
use vauchi_core::network::simple_message::{
    create_device_sync_ack, create_signed_handshake, create_simple_ack, create_simple_envelope,
    decode_simple_message, encode_simple_message, SimpleAckStatus, SimpleDeviceSyncMessage,
    SimpleEncryptedUpdate, SimplePayload,
};
use vauchi_core::sync::{process_card_updates, DeviceSyncOrchestrator, SyncItem};
use vauchi_core::{Contact, ContactCard, Identity, Storage};

use crate::state::AppState;

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

/// Connect to relay server via WebSocket with timeout.
fn connect_to_relay(relay_url: &str) -> Result<WebSocket<MaybeTlsStream<TcpStream>>, String> {
    use std::net::ToSocketAddrs;
    use url::Url;

    // Parse URL to get host and port
    let url = Url::parse(relay_url).map_err(|e| format!("Invalid relay URL: {}", e))?;
    let host = url.host_str().ok_or("No host in relay URL")?;
    let port = url
        .port()
        .unwrap_or(if url.scheme() == "wss" { 443 } else { 80 });
    let addr_str = format!("{}:{}", host, port);

    // Resolve address
    let addr = addr_str
        .to_socket_addrs()
        .map_err(|e| format!("Failed to resolve {}: {}", addr_str, e))?
        .next()
        .ok_or_else(|| format!("No addresses found for {}", addr_str))?;

    // Connect with timeout (2 seconds for responsive UX)
    let stream = TcpStream::connect_timeout(&addr, Duration::from_secs(2))
        .map_err(|e| format!("Connection failed: {}", e))?;

    // Set read/write timeouts (3 seconds)
    stream.set_read_timeout(Some(Duration::from_secs(3))).ok();
    stream.set_write_timeout(Some(Duration::from_secs(3))).ok();

    // Handle TLS if needed
    let tls_stream: MaybeTlsStream<TcpStream> = if url.scheme() == "wss" {
        let connector = native_tls::TlsConnector::new()
            .map_err(|e| format!("Failed to create TLS connector: {}", e))?;
        let tls_stream = connector
            .connect(host, stream)
            .map_err(|e| format!("TLS handshake failed: {}", e))?;
        MaybeTlsStream::NativeTls(tls_stream)
    } else {
        MaybeTlsStream::Plain(stream)
    };

    // Perform WebSocket handshake
    let (socket, _response) = tungstenite::client(relay_url, tls_stream)
        .map_err(|e| format!("WebSocket handshake failed: {}", e))?;

    Ok(socket)
}

/// Send authenticated handshake to relay.
fn send_handshake(
    socket: &mut WebSocket<MaybeTlsStream<TcpStream>>,
    identity: &Identity,
    device_id: Option<&str>,
) -> Result<(), String> {
    let handshake = create_signed_handshake(identity, device_id.map(|s| s.to_string()));
    let envelope = create_simple_envelope(SimplePayload::Handshake(handshake));
    let data = encode_simple_message(&envelope).map_err(|e| format!("Encode error: {}", e))?;
    socket
        .send(Message::Binary(data))
        .map_err(|e| format!("Send error: {}", e))?;
    Ok(())
}

/// Received messages from relay.
struct ReceivedMessages {
    encrypted_exchange: Vec<Vec<u8>>,
    card_updates: Vec<(String, Vec<u8>)>,
    device_sync_messages: Vec<SimpleDeviceSyncMessage>,
}

/// Receive pending messages from relay.
fn receive_pending(
    socket: &mut WebSocket<MaybeTlsStream<TcpStream>>,
) -> Result<ReceivedMessages, String> {
    let mut encrypted_exchange = Vec::new();
    let mut card_updates = Vec::new();
    let mut device_sync_messages = Vec::new();

    // Set read timeout for non-blocking receive
    if let MaybeTlsStream::Plain(ref stream) = socket.get_ref() {
        let _ = stream.set_read_timeout(Some(Duration::from_millis(1000)));
    }

    loop {
        match socket.read() {
            Ok(Message::Binary(data)) => {
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
                                let _ = socket.send(Message::Binary(ack_data));
                            }
                        }
                        SimplePayload::DeviceSyncMessage(msg) => {
                            // Get version before moving msg
                            let version = msg.version;
                            device_sync_messages.push(msg);

                            // Send device sync ack
                            let ack = create_device_sync_ack(&envelope.message_id, version);
                            if let Ok(ack_data) = encode_simple_message(&ack) {
                                let _ = socket.send(Message::Binary(ack_data));
                            }
                        }
                        _ => {}
                    }
                }
            }
            Ok(Message::Ping(data)) => {
                let _ = socket.send(Message::Pong(data));
            }
            Ok(Message::Close(_)) => break,
            Ok(_) => { /* Ignore other message types */ }
            Err(tungstenite::Error::Io(ref e))
                if e.kind() == std::io::ErrorKind::WouldBlock
                    || e.kind() == std::io::ErrorKind::TimedOut =>
            {
                break;
            }
            Err(_) => break,
        }
    }

    Ok(ReceivedMessages {
        encrypted_exchange,
        card_updates,
        device_sync_messages,
    })
}

/// Process encrypted exchange messages.
fn process_encrypted_exchanges(
    identity: &Identity,
    storage: &Storage,
    encrypted_data: Vec<Vec<u8>>,
    relay_url: &str,
) -> Result<u32, String> {
    let mut added = 0u32;
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

        // Send response
        let _ = send_exchange_response(identity, &public_id, &payload.exchange_key, relay_url);
    }

    Ok(added)
}

/// Send exchange response.
fn send_exchange_response(
    identity: &Identity,
    recipient_id: &str,
    recipient_exchange_key: &[u8; 32],
    relay_url: &str,
) -> Result<(), String> {
    let mut socket = connect_to_relay(relay_url)?;

    send_handshake(&mut socket, identity, None)?;

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
        .map_err(|e| e.to_string())?;

    std::thread::sleep(Duration::from_millis(100));
    let _ = socket.close(None);

    Ok(())
}

// Card update processing is now handled by vauchi_core::sync::process_card_updates
// which provides the full secure pipeline (revocation, signature, replay detection).

/// Send pending outbound updates.
fn send_pending_updates(
    identity: &Identity,
    storage: &Storage,
    socket: &mut WebSocket<MaybeTlsStream<TcpStream>>,
) -> Result<u32, String> {
    let contacts = storage.list_contacts().map_err(|e| e.to_string())?;
    let our_id = identity.public_id();
    let mut sent = 0u32;

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
                if socket.send(Message::Binary(data)).is_ok() {
                    let _ = storage.delete_pending_update(&update.id);
                    sent += 1;
                }
            }
        }
    }

    Ok(sent)
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

struct WsSender<'a>(&'a mut WebSocket<MaybeTlsStream<TcpStream>>);

impl vauchi_core::sync::BinarySender for WsSender<'_> {
    fn send_binary(&mut self, data: Vec<u8>) -> Result<(), String> {
        self.0
            .send(Message::Binary(data))
            .map_err(|e| e.to_string())
    }
}

/// Perform a sync with the relay server.
///
/// This sends pending updates to contacts and receives incoming updates.
#[tauri::command]
pub fn sync(state: State<'_, Mutex<AppState>>) -> Result<SyncResult, String> {
    let state = state.lock().unwrap();

    let identity = state
        .identity
        .as_ref()
        .ok_or("No identity found. Please create an identity first.")?;

    let relay_url = state.relay_url();
    let device_id_hex = hex::encode(identity.device_id());

    // Connect to relay with timeout
    let mut socket = connect_to_relay(relay_url)?;

    // Send authenticated handshake with device_id for inter-device sync
    send_handshake(&mut socket, identity, Some(&device_id_hex))?;

    // Brief wait for server to send pending messages (reduced from 500ms)
    std::thread::sleep(Duration::from_millis(100));

    // Receive pending messages
    let received = receive_pending(&mut socket)?;

    // Process encrypted exchange messages
    let encrypted_added = process_encrypted_exchanges(
        identity,
        &state.storage,
        received.encrypted_exchange,
        relay_url,
    )?;

    let contacts_added = encrypted_added;

    // Process card updates (uses core's secure pipeline with full security checks)
    let card_result = process_card_updates(identity, &state.storage, received.card_updates)
        .map_err(|e| e.to_string())?;
    let cards_updated = card_result.processed;

    // Process device sync messages (inter-device synchronization)
    let device_synced =
        process_device_sync_messages(identity, &state.storage, received.device_sync_messages)?;

    // Send pending device sync items to other devices
    let device_sync_sent =
        vauchi_core::sync::send_device_sync(identity, &state.storage, &mut WsSender(&mut socket))
            .map_err(|e| format!("Send device sync failed: {:?}", e))?;

    // Send pending outbound updates
    let updates_sent = send_pending_updates(identity, &state.storage, &mut socket)?;

    // Close connection
    let _ = socket.close(None);

    Ok(SyncResult {
        contacts_added,
        cards_updated: cards_updated + device_synced,
        updates_sent: updates_sent + device_sync_sent,
        success: true,
        error: None,
    })
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
