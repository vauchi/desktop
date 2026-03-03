// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Decoy Contact Commands
//!
//! Tauri commands for managing decoy contacts displayed during duress mode.
//! These fake contacts replace real contacts when the duress PIN is used,
//! making the app appear normal to an observer.

use std::sync::Mutex;

use crate::error::CommandError;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Decoy contact info returned to the frontend.
#[derive(Serialize)]
pub struct DecoyContactInfo {
    pub id: String,
    pub display_name: String,
}

/// Input for creating a decoy contact.
#[derive(Deserialize)]
pub struct DecoyContactInput {
    pub display_name: String,
}

/// List all decoy contacts.
#[tauri::command]
pub fn list_decoy_contacts(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<DecoyContactInfo>, CommandError> {
    let state = state.lock().unwrap();

    let contacts = state
        .storage
        .load_decoy_contacts()
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    Ok(contacts
        .into_iter()
        .map(|(id, display_name, _card)| DecoyContactInfo { id, display_name })
        .collect())
}

/// Add a new decoy contact with the given display name.
///
/// Creates a minimal ContactCard for the decoy. The ID is generated as a UUID.
#[tauri::command]
pub fn add_decoy_contact(
    input: DecoyContactInput,
    state: State<'_, Mutex<AppState>>,
) -> Result<DecoyContactInfo, CommandError> {
    let state = state.lock().unwrap();

    let card = vauchi_core::ContactCard::new(&input.display_name);
    let id = card.id().to_string();

    state
        .storage
        .save_decoy_contact(&id, &input.display_name, &card)
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    Ok(DecoyContactInfo {
        id,
        display_name: input.display_name,
    })
}

/// Remove a decoy contact by ID.
#[tauri::command]
pub fn remove_decoy_contact(
    id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), CommandError> {
    let state = state.lock().unwrap();

    state
        .storage
        .delete_decoy_contact(&id)
        .map_err(|e| CommandError::Storage(e.to_string()))
}

/// Remove all decoy contacts.
#[tauri::command]
pub fn clear_decoy_contacts(state: State<'_, Mutex<AppState>>) -> Result<(), CommandError> {
    let state = state.lock().unwrap();

    state
        .storage
        .clear_all_decoy_contacts()
        .map_err(|e| CommandError::Storage(e.to_string()))
}
