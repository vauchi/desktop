// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Exchange Commands
//!
//! Handles contact exchange via the mutual QR flow.
//! Both peers generate and scan QR codes; ManualConfirmationVerifier is used
//! for the visual fingerprint confirmation step on desktop.

use std::sync::Mutex;

use serde::Serialize;
use tauri::State;
use vauchi_core::contact_card::ContactCard;
use vauchi_core::exchange::{
    ExchangeEvent, ExchangeQR, ExchangeSession, ExchangeState, ManualConfirmationVerifier,
};

use crate::state::AppState;

/// Exchange QR data for the frontend.
#[derive(Serialize)]
pub struct ExchangeQRResponse {
    /// Base64-encoded QR data string
    pub data: String,
    /// Display name shown in QR
    pub display_name: String,
    /// ASCII art representation of QR (for terminal/testing)
    pub qr_ascii: String,
}

/// Result of completing an exchange.
#[derive(Serialize)]
pub struct ExchangeResult {
    /// Whether the exchange was successful
    pub success: bool,
    /// The new contact's display name (placeholder until sync)
    pub contact_name: String,
    /// The new contact's public ID (hex-encoded)
    pub contact_id: String,
    /// Message for the user
    pub message: String,
}

/// Start a mutual QR exchange (display our QR).
///
/// Creates an ExchangeSession via `new_qr`, triggers `StartQR` to
/// generate our QR code, and stores the session in AppState.
#[tauri::command]
pub fn start_exchange(state: State<'_, Mutex<AppState>>) -> Result<ExchangeQRResponse, String> {
    let mut state = state.lock().unwrap();

    if !state.has_identity() {
        return Err("No identity found. Please create an identity first.".to_string());
    }

    let identity = state
        .create_owned_identity()
        .map_err(|e| format!("Failed to load identity: {}", e))?;

    let our_card = state
        .storage
        .load_own_card()
        .ok()
        .flatten()
        .unwrap_or_else(|| ContactCard::new(identity.display_name()));

    let display_name = identity.display_name().to_string();

    let verifier = ManualConfirmationVerifier::new();
    let mut session = ExchangeSession::new_qr(identity, our_card, verifier);

    // Generate QR via StartQR
    session
        .apply(ExchangeEvent::StartQR)
        .map_err(|e| format!("Failed to generate QR: {:?}", e))?;

    let (data, qr_ascii) = match session.qr() {
        Some(qr) => (qr.to_data_string(), qr.to_qr_image_string()),
        None => return Err("QR code not generated".to_string()),
    };

    state.exchange_session = Some(session);

    Ok(ExchangeQRResponse {
        data,
        display_name,
        qr_ascii,
    })
}

/// Process a scanned QR code from the peer.
///
/// Creates a QR ExchangeSession, applies `StartQR` to initialise it,
/// then applies `ProcessQR` with the scanned data.
#[tauri::command]
pub fn process_scanned_qr(data: String, state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut state = state.lock().unwrap();

    if !state.has_identity() {
        return Err("No identity found. Please create an identity first.".to_string());
    }

    let identity = state
        .create_owned_identity()
        .map_err(|e| format!("Failed to load identity: {}", e))?;

    let our_card = state
        .storage
        .load_own_card()
        .ok()
        .flatten()
        .unwrap_or_else(|| ContactCard::new(identity.display_name()));

    let qr =
        ExchangeQR::from_data_string(&data).map_err(|e| format!("Invalid QR code: {:?}", e))?;

    if qr.is_expired() {
        return Err("This QR code has expired. Please ask them to generate a new one.".to_string());
    }

    let verifier = ManualConfirmationVerifier::new();
    let mut session = ExchangeSession::new_qr(identity, our_card, verifier);

    // Initialise the session, then process the scanned QR
    session
        .apply(ExchangeEvent::StartQR)
        .map_err(|e| format!("Failed to start QR session: {:?}", e))?;

    session
        .apply(ExchangeEvent::ProcessQR(qr))
        .map_err(|e| format!("Failed to process QR: {:?}", e))?;

    state.exchange_session = Some(session);

    Ok(())
}

/// Confirm the peer has scanned our QR code.
///
/// In the mutual QR flow the frontend calls this after detecting (or the
/// user confirming) that the other party has successfully scanned our QR.
#[tauri::command]
pub fn confirm_peer_scan(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut state = state.lock().unwrap();

    let session = state
        .exchange_session
        .as_mut()
        .ok_or("No exchange session active")?;

    session
        .apply(ExchangeEvent::TheyScannedOurQR)
        .map_err(|e| format!("Peer scan confirmation failed: {:?}", e))?;

    Ok(())
}

/// Complete the exchange.
///
/// Performs key agreement, exchanges cards, saves the contact.
#[tauri::command]
pub fn complete_exchange(state: State<'_, Mutex<AppState>>) -> Result<ExchangeResult, String> {
    let mut state = state.lock().unwrap();

    // Take the session out of state so we can use state.storage later
    let mut session = state
        .exchange_session
        .take()
        .ok_or("No exchange session active")?;

    // Perform key agreement
    session
        .apply(ExchangeEvent::PerformKeyAgreement)
        .map_err(|e| format!("Key agreement failed: {:?}", e))?;

    // Get their public key for the contact ID
    let their_public_key = match session.state() {
        ExchangeState::AwaitingCardExchange {
            their_public_key, ..
        } => *their_public_key,
        _ => return Err("Session not in expected state after key agreement".to_string()),
    };

    let contact_id = hex::encode(their_public_key);

    // Check if we already have this contact
    if state
        .storage
        .load_contact(&contact_id)
        .ok()
        .flatten()
        .is_some()
    {
        return Ok(ExchangeResult {
            success: false,
            contact_name: "Unknown".to_string(),
            contact_id,
            message: "You already have this contact.".to_string(),
        });
    }

    // Complete exchange with placeholder card
    let placeholder_name = format!("Contact {}", &contact_id[..8]);
    let card = ContactCard::new(&placeholder_name);

    session
        .apply(ExchangeEvent::CompleteExchange(card))
        .map_err(|e| format!("Card exchange failed: {:?}", e))?;

    // Extract contact and save
    let contact = match session.state() {
        ExchangeState::Complete { contact } => contact.clone(),
        _ => return Err("Session not in Complete state".to_string()),
    };

    state
        .storage
        .save_contact(&contact)
        .map_err(|e| format!("Failed to save contact: {:?}", e))?;

    let contact_name = contact.display_name().to_string();

    Ok(ExchangeResult {
        success: true,
        contact_name,
        contact_id,
        message: "Contact added! Run sync to receive their contact card.".to_string(),
    })
}
