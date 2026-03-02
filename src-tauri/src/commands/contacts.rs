// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Contacts Commands

use std::sync::Mutex;

use serde::Serialize;
use tauri::State;
use vauchi_core::ContactField;

use crate::error::CommandError;
use crate::state::AppState;

/// Contact information for the frontend.
#[derive(Serialize)]
pub struct ContactInfo {
    pub id: String,
    pub display_name: String,
    pub verified: bool,
    pub recovery_trusted: bool,
}

/// Contact details for the frontend.
#[derive(Serialize)]
pub struct ContactDetails {
    pub id: String,
    pub display_name: String,
    pub verified: bool,
    pub recovery_trusted: bool,
    pub fields: Vec<super::card::FieldInfo>,
}

/// List all visible (non-hidden) contacts.
#[tauri::command]
pub fn list_contacts(state: State<'_, Mutex<AppState>>) -> Result<Vec<ContactInfo>, CommandError> {
    let state = state.lock().unwrap();

    let contacts = state.storage.list_contacts()?;

    Ok(contacts
        .into_iter()
        .filter(|c| !c.is_hidden())
        .map(|c| ContactInfo {
            id: c.id().to_string(),
            display_name: c.display_name().to_string(),
            verified: c.is_fingerprint_verified(),
            recovery_trusted: c.is_recovery_trusted(),
        })
        .collect())
}

/// List contacts with pagination.
#[tauri::command]
pub fn list_contacts_paginated(
    offset: u32,
    limit: u32,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<ContactInfo>, CommandError> {
    let state = state.lock().unwrap();

    let contacts = state
        .storage
        .list_contacts_paginated(offset as usize, limit as usize)?;

    Ok(contacts
        .into_iter()
        .map(|c| ContactInfo {
            id: c.id().to_string(),
            display_name: c.display_name().to_string(),
            verified: c.is_fingerprint_verified(),
            recovery_trusted: c.is_recovery_trusted(),
        })
        .collect())
}

/// Search contacts using SQL-level search.
#[tauri::command]
pub fn search_contacts(
    query: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<ContactInfo>, CommandError> {
    let state = state.lock().unwrap();

    let contacts = state.storage.search_contacts(&query)?;

    Ok(contacts
        .into_iter()
        .map(|c| ContactInfo {
            id: c.id().to_string(),
            display_name: c.display_name().to_string(),
            verified: c.is_fingerprint_verified(),
            recovery_trusted: c.is_recovery_trusted(),
        })
        .collect())
}

/// Get a specific contact.
#[tauri::command]
pub fn get_contact(
    id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<ContactDetails, CommandError> {
    let state = state.lock().unwrap();

    let contact = state
        .storage
        .load_contact(&id)?
        .ok_or_else(|| CommandError::Contact("Contact not found".to_string()))?;

    let fields: Vec<super::card::FieldInfo> = contact
        .card()
        .fields()
        .iter()
        .map(|f: &ContactField| super::card::FieldInfo {
            id: f.id().to_string(),
            field_type: format!("{:?}", f.field_type()),
            label: f.label().to_string(),
            value: f.value().to_string(),
        })
        .collect();

    Ok(ContactDetails {
        id: contact.id().to_string(),
        display_name: contact.display_name().to_string(),
        verified: contact.is_fingerprint_verified(),
        recovery_trusted: contact.is_recovery_trusted(),
        fields,
    })
}

/// Remove a contact.
#[tauri::command]
pub fn remove_contact(id: String, state: State<'_, Mutex<AppState>>) -> Result<bool, CommandError> {
    let state = state.lock().unwrap();

    state
        .storage
        .delete_contact(&id)
        .map_err(CommandError::from)
}

/// Fingerprint info for verification.
#[derive(Serialize)]
pub struct FingerprintInfo {
    /// The contact's fingerprint as a hex string.
    pub their_fingerprint: String,
    /// Our fingerprint as a hex string.
    pub our_fingerprint: String,
    /// Human-readable fingerprint comparison (formatted for display).
    pub formatted_their: String,
    /// Human-readable fingerprint comparison (formatted for display).
    pub formatted_our: String,
}

/// Format raw hex as groups of 4 uppercase chars for human-readable display.
fn format_hex_fingerprint(raw_hex: &str) -> String {
    raw_hex
        .chars()
        .collect::<Vec<_>>()
        .chunks(4)
        .map(|c| c.iter().collect::<String>())
        .collect::<Vec<_>>()
        .join(" ")
        .to_uppercase()
}

/// Get fingerprint information for contact verification.
#[tauri::command]
pub fn get_contact_fingerprint(
    id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<FingerprintInfo, CommandError> {
    let state = state.lock().unwrap();

    let identity = state
        .identity
        .as_ref()
        .ok_or_else(|| CommandError::Identity("No identity found".to_string()))?;

    let contact = state
        .storage
        .load_contact(&id)?
        .ok_or_else(|| CommandError::Contact("Contact not found".to_string()))?;

    // Use Contact::fingerprint() API for the contact's fingerprint
    let formatted_their = contact.fingerprint();
    let their_fingerprint = hex::encode(contact.public_key());

    // Format our own fingerprint the same way
    let our_fingerprint = hex::encode(identity.signing_keypair().public_key().as_bytes());
    let formatted_our = format_hex_fingerprint(&our_fingerprint);

    Ok(FingerprintInfo {
        their_fingerprint,
        our_fingerprint,
        formatted_their,
        formatted_our,
    })
}

/// Mark a contact as verified.
#[tauri::command]
pub fn verify_contact(id: String, state: State<'_, Mutex<AppState>>) -> Result<bool, CommandError> {
    let state = state.lock().unwrap();

    // Load the contact
    let mut contact = state
        .storage
        .load_contact(&id)?
        .ok_or_else(|| CommandError::Contact("Contact not found".to_string()))?;

    // Mark as verified
    contact.mark_fingerprint_verified();

    // Save the updated contact
    state
        .storage
        .save_contact(&contact)
        .map_err(|e| CommandError::Contact(format!("Failed to save contact: {:?}", e)))?;

    Ok(true)
}

/// Mark a contact as trusted for recovery.
#[tauri::command]
pub fn trust_contact(id: String, state: State<'_, Mutex<AppState>>) -> Result<bool, CommandError> {
    let state = state.lock().unwrap();

    let mut contact = state
        .storage
        .load_contact(&id)?
        .ok_or_else(|| CommandError::Contact("Contact not found".to_string()))?;

    if contact.is_blocked() {
        return Err(CommandError::Contact(
            "Blocked contacts cannot be trusted for recovery".to_string(),
        ));
    }

    contact.trust_for_recovery();

    state
        .storage
        .save_contact(&contact)
        .map_err(|e| CommandError::Contact(format!("Failed to save contact: {:?}", e)))?;

    Ok(true)
}

/// Remove recovery trust from a contact.
#[tauri::command]
pub fn untrust_contact(
    id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, CommandError> {
    let state = state.lock().unwrap();

    let mut contact = state
        .storage
        .load_contact(&id)?
        .ok_or_else(|| CommandError::Contact("Contact not found".to_string()))?;

    contact.untrust_for_recovery();

    state
        .storage
        .save_contact(&contact)
        .map_err(|e| CommandError::Contact(format!("Failed to save contact: {:?}", e)))?;

    Ok(true)
}

/// Get the number of contacts trusted for recovery.
#[tauri::command]
pub fn trusted_contact_count(state: State<'_, Mutex<AppState>>) -> Result<u32, CommandError> {
    let state = state.lock().unwrap();

    let contacts = state.storage.list_contacts()?;
    let count = contacts.iter().filter(|c| c.is_recovery_trusted()).count();

    Ok(count as u32)
}

/// Hide a contact so it doesn't appear in the default contact list.
#[tauri::command]
pub fn hide_contact(id: String, state: State<'_, Mutex<AppState>>) -> Result<bool, CommandError> {
    let state = state.lock().unwrap();

    let mut contact = state
        .storage
        .load_contact(&id)?
        .ok_or_else(|| CommandError::Contact("Contact not found".to_string()))?;

    contact.hide();

    state
        .storage
        .save_contact(&contact)
        .map_err(|e| CommandError::Contact(format!("Failed to save contact: {:?}", e)))?;

    Ok(true)
}

/// Unhide a previously hidden contact.
#[tauri::command]
pub fn unhide_contact(id: String, state: State<'_, Mutex<AppState>>) -> Result<bool, CommandError> {
    let state = state.lock().unwrap();

    let mut contact = state
        .storage
        .load_contact(&id)?
        .ok_or_else(|| CommandError::Contact("Contact not found".to_string()))?;

    contact.unhide();

    state
        .storage
        .save_contact(&contact)
        .map_err(|e| CommandError::Contact(format!("Failed to save contact: {:?}", e)))?;

    Ok(true)
}

/// List hidden contacts.
#[tauri::command]
pub fn list_hidden_contacts(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<ContactInfo>, CommandError> {
    let state = state.lock().unwrap();

    let contacts = state.storage.list_contacts()?;
    let hidden: Vec<ContactInfo> = contacts
        .into_iter()
        .filter(|c| c.is_hidden())
        .map(|c| ContactInfo {
            id: c.id().to_string(),
            display_name: c.display_name().to_string(),
            verified: c.is_fingerprint_verified(),
            recovery_trusted: c.is_recovery_trusted(),
        })
        .collect();

    Ok(hidden)
}
