// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Contacts Commands

use std::sync::Mutex;

use serde::Serialize;
use tauri::State;
use vauchi_core::{AuthMode, ContactField};

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
///
/// In duress mode, returns decoy contacts instead of real ones.
#[tauri::command]
pub fn list_contacts(state: State<'_, Mutex<AppState>>) -> Result<Vec<ContactInfo>, CommandError> {
    let state = state.lock().unwrap();

    if state.auth_mode == AuthMode::Duress {
        let decoys = state
            .storage
            .load_decoy_contacts()
            .map_err(|e| CommandError::Storage(e.to_string()))?;
        return Ok(decoys
            .into_iter()
            .map(|(id, display_name, _card)| ContactInfo {
                id,
                display_name,
                verified: false,
                recovery_trusted: false,
            })
            .collect());
    }

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
///
/// In duress mode, paginates over decoy contacts.
#[tauri::command]
pub fn list_contacts_paginated(
    offset: u32,
    limit: u32,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<ContactInfo>, CommandError> {
    let state = state.lock().unwrap();

    if state.auth_mode == AuthMode::Duress {
        let decoys = state
            .storage
            .load_decoy_contacts()
            .map_err(|e| CommandError::Storage(e.to_string()))?;
        return Ok(decoys
            .into_iter()
            .skip(offset as usize)
            .take(limit as usize)
            .map(|(id, display_name, _card)| ContactInfo {
                id,
                display_name,
                verified: false,
                recovery_trusted: false,
            })
            .collect());
    }

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
///
/// In duress mode, searches decoy contacts by display name.
#[tauri::command]
pub fn search_contacts(
    query: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<ContactInfo>, CommandError> {
    let state = state.lock().unwrap();

    if state.auth_mode == AuthMode::Duress {
        let decoys = state
            .storage
            .load_decoy_contacts()
            .map_err(|e| CommandError::Storage(e.to_string()))?;
        let query_lower = query.to_lowercase();
        return Ok(decoys
            .into_iter()
            .filter(|(_id, name, _card)| name.to_lowercase().contains(&query_lower))
            .map(|(id, display_name, _card)| ContactInfo {
                id,
                display_name,
                verified: false,
                recovery_trusted: false,
            })
            .collect());
    }

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
///
/// In duress mode, looks up decoy contacts instead.
#[tauri::command]
pub fn get_contact(
    id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<ContactDetails, CommandError> {
    let state = state.lock().unwrap();

    if state.auth_mode == AuthMode::Duress {
        let decoys = state
            .storage
            .load_decoy_contacts()
            .map_err(|e| CommandError::Storage(e.to_string()))?;
        let decoy = decoys
            .into_iter()
            .find(|(did, _, _)| did == &id)
            .ok_or_else(|| CommandError::Contact("Contact not found".to_string()))?;
        let fields: Vec<super::card::FieldInfo> = decoy
            .2
            .fields()
            .iter()
            .map(|f: &ContactField| super::card::FieldInfo {
                id: f.id().to_string(),
                field_type: format!("{:?}", f.field_type()),
                label: f.label().to_string(),
                value: f.value().to_string(),
            })
            .collect();
        return Ok(ContactDetails {
            id: decoy.0,
            display_name: decoy.1,
            verified: false,
            recovery_trusted: false,
            fields,
        });
    }

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

/// A detected duplicate contact pair with similarity score.
#[derive(Serialize)]
pub struct DuplicatePairInfo {
    /// ID of the first contact.
    pub id1: String,
    /// Display name of the first contact.
    pub name1: String,
    /// ID of the second contact.
    pub id2: String,
    /// Display name of the second contact.
    pub name2: String,
    /// Similarity score (0.0 to 1.0).
    pub similarity: f64,
}

/// Find potential duplicate contacts.
///
/// Returns duplicate pairs ordered by similarity (highest first),
/// excluding pairs the user has previously dismissed.
#[tauri::command]
pub fn find_duplicates(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<DuplicatePairInfo>, CommandError> {
    let state = state.lock().unwrap();

    let contacts = state.storage.list_contacts()?;
    let all_duplicates = vauchi_core::contact::merge::find_duplicates(&contacts);

    // Load dismissed pairs and filter them out
    let dismissed = state
        .storage
        .load_dismissed_duplicates()
        .map_err(|e| CommandError::Storage(e.to_string()))?;
    let filtered = vauchi_core::contact::merge::filter_dismissed(all_duplicates, &dismissed);

    // Build contact name lookup
    let name_map: std::collections::HashMap<String, String> = contacts
        .iter()
        .map(|c| (c.id().to_string(), c.display_name().to_string()))
        .collect();

    Ok(filtered
        .into_iter()
        .map(|pair| DuplicatePairInfo {
            name1: name_map.get(&pair.id1).cloned().unwrap_or_default(),
            name2: name_map.get(&pair.id2).cloned().unwrap_or_default(),
            id1: pair.id1,
            id2: pair.id2,
            similarity: pair.similarity,
        })
        .collect())
}

/// Dismiss a duplicate suggestion so it no longer appears.
///
/// The pair key is normalized (id1 < id2) so dismissing (A, B) is the
/// same as dismissing (B, A).
#[tauri::command]
pub fn dismiss_duplicate(
    contact_id_a: String,
    contact_id_b: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, CommandError> {
    let state = state.lock().unwrap();

    let (norm1, norm2) =
        vauchi_core::contact::merge::normalize_pair_key(&contact_id_a, &contact_id_b);
    state
        .storage
        .dismiss_duplicate(&norm1, &norm2)
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    Ok(true)
}

/// Undo a previously dismissed duplicate suggestion.
#[tauri::command]
pub fn undismiss_duplicate(
    contact_id_a: String,
    contact_id_b: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, CommandError> {
    let state = state.lock().unwrap();

    let (norm1, norm2) =
        vauchi_core::contact::merge::normalize_pair_key(&contact_id_a, &contact_id_b);
    state
        .storage
        .undismiss_duplicate(&norm1, &norm2)
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    Ok(true)
}

/// Merge two contacts, keeping the primary and incorporating fields
/// from the secondary.
///
/// After merge:
/// - The primary contact has all unique fields from both contacts
/// - The secondary contact is deleted from storage
/// - Returns the merged contact details
#[tauri::command]
pub fn merge_contacts(
    primary_id: String,
    secondary_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<ContactDetails, CommandError> {
    let state = state.lock().unwrap();

    let primary = state
        .storage
        .load_contact(&primary_id)?
        .ok_or_else(|| CommandError::Contact("Primary contact not found".to_string()))?;
    let secondary = state
        .storage
        .load_contact(&secondary_id)?
        .ok_or_else(|| CommandError::Contact("Secondary contact not found".to_string()))?;

    let merged = vauchi_core::contact::merge::merge_contacts(&primary, &secondary);

    // Save merged contact
    state
        .storage
        .save_contact(&merged)
        .map_err(|e| CommandError::Contact(format!("Failed to save merged contact: {:?}", e)))?;

    // Delete secondary
    state.storage.delete_contact(&secondary_id).map_err(|e| {
        CommandError::Contact(format!("Failed to delete secondary contact: {:?}", e))
    })?;

    let fields: Vec<super::card::FieldInfo> = merged
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
        id: merged.id().to_string(),
        display_name: merged.display_name().to_string(),
        verified: merged.is_fingerprint_verified(),
        recovery_trusted: merged.is_recovery_trusted(),
        fields,
    })
}

/// Get the current contact limit.
#[tauri::command]
pub fn get_contact_limit(state: State<'_, Mutex<AppState>>) -> Result<usize, CommandError> {
    let state = state.lock().unwrap();

    state
        .storage
        .get_contact_limit()
        .map_err(|e| CommandError::Storage(e.to_string()))
}

/// Set the contact limit.
#[tauri::command]
pub fn set_contact_limit(
    limit: usize,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, CommandError> {
    let state = state.lock().unwrap();

    state
        .storage
        .set_contact_limit(limit)
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    Ok(true)
}
