// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Field Validation Commands
//!
//! Tauri IPC commands for crowd-sourced field validation.

use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use serde::Serialize;
use tauri::State;
use vauchi_core::{ProfileValidation, ValidationStatus};

use crate::error::CommandError;
use crate::state::AppState;

/// Validation status information for the frontend.
#[derive(Serialize, Clone, Debug)]
pub struct ValidationStatusInfo {
    /// Number of validations for this field.
    pub count: usize,
    /// Trust level label (e.g. "unverified", "low confidence").
    pub trust_level: String,
    /// Trust level color for UI indicators.
    pub color: String,
    /// Whether the current user has validated this field.
    pub validated_by_me: bool,
    /// Human-readable display text (e.g. "Verified by Bob and 2 others").
    pub display_text: String,
}

/// A single validation record for the frontend.
#[derive(Serialize, Clone, Debug)]
pub struct FieldValidationInfo {
    pub contact_id: String,
    pub field_name: String,
    pub field_value: String,
    pub validator_id: String,
    pub validated_at: u64,
}

/// Validate a contact's field (sign an attestation that the field value is correct).
#[tauri::command]
pub fn validate_contact_field(
    contact_id: String,
    field_id: String,
    field_value: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<FieldValidationInfo, CommandError> {
    let state = state.lock().unwrap();

    let identity = state
        .identity
        .as_ref()
        .ok_or_else(|| CommandError::Identity("No identity found".to_string()))?;

    // Check sybil resistance — don't allow duplicate validations
    let existing = state
        .storage
        .load_validations_for_field(&contact_id, &field_id)
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    let my_id = hex::encode(identity.signing_public_key());
    let full_field_id = format!("{}:{}", contact_id, field_id);
    let already_validated = existing
        .iter()
        .any(|v| v.validator_id() == my_id && v.field_id() == full_field_id);

    if already_validated {
        return Err(CommandError::Validation(
            "You have already validated this field".to_string(),
        ));
    }

    // Create signed validation
    let validation =
        ProfileValidation::create_signed(identity, &field_id, &field_value, &contact_id);

    // Store it
    state
        .storage
        .save_validation(&validation)
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    Ok(FieldValidationInfo {
        contact_id: validation.contact_id().unwrap_or("").to_string(),
        field_name: validation.field_name().unwrap_or("").to_string(),
        field_value: validation.field_value().to_string(),
        validator_id: validation.validator_id().to_string(),
        validated_at: validation.validated_at(),
    })
}

/// Get the validation status for a specific contact field.
#[tauri::command]
pub fn get_field_validation_status(
    contact_id: String,
    field_id: String,
    field_value: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<ValidationStatusInfo, CommandError> {
    let state = state.lock().unwrap();

    let validations = state
        .storage
        .load_validations_for_field(&contact_id, &field_id)
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    let my_id = state
        .identity
        .as_ref()
        .map(|i| hex::encode(i.signing_public_key()));

    let blocked = HashSet::new(); // TODO: load blocked contacts when blocking is implemented

    let status =
        ValidationStatus::from_validations(&validations, &field_value, my_id.as_deref(), &blocked);

    // Build known names map from contacts for display
    let known_names = build_known_names_map(&state);

    Ok(ValidationStatusInfo {
        count: status.count,
        trust_level: status.trust_level.label().to_string(),
        color: status.trust_level.color().to_string(),
        validated_by_me: status.validated_by_me,
        display_text: status.display(&known_names),
    })
}

/// Revoke the current user's validation of a field.
#[tauri::command]
pub fn revoke_field_validation(
    contact_id: String,
    field_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, CommandError> {
    let state = state.lock().unwrap();

    let identity = state
        .identity
        .as_ref()
        .ok_or_else(|| CommandError::Identity("No identity found".to_string()))?;

    let my_id = hex::encode(identity.signing_public_key());

    state
        .storage
        .delete_validation(&contact_id, &field_id, &my_id)
        .map_err(|e| CommandError::Storage(e.to_string()))
}

/// Get the validation count for a specific field.
#[tauri::command]
pub fn get_field_validation_count(
    contact_id: String,
    field_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<u32, CommandError> {
    let state = state.lock().unwrap();

    let count = state
        .storage
        .count_validations_for_field(&contact_id, &field_id)
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    Ok(count as u32)
}

/// List all validations made by the current user.
#[tauri::command]
pub fn list_my_validations(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<FieldValidationInfo>, CommandError> {
    let state = state.lock().unwrap();

    let identity = state
        .identity
        .as_ref()
        .ok_or_else(|| CommandError::Identity("No identity found".to_string()))?;

    let my_id = hex::encode(identity.signing_public_key());

    let validations = state
        .storage
        .load_validations_by_validator(&my_id)
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    Ok(validations
        .iter()
        .map(|v| FieldValidationInfo {
            contact_id: v.contact_id().unwrap_or("").to_string(),
            field_name: v.field_name().unwrap_or("").to_string(),
            field_value: v.field_value().to_string(),
            validator_id: v.validator_id().to_string(),
            validated_at: v.validated_at(),
        })
        .collect())
}

/// Build a map of validator_id -> display_name from known contacts.
fn build_known_names_map(state: &AppState) -> HashMap<String, String> {
    let mut names = HashMap::new();

    if let Ok(contacts) = state.storage.list_contacts() {
        for contact in contacts {
            let pk_hex = hex::encode(contact.public_key());
            names.insert(pk_hex, contact.display_name().to_string());
        }
    }

    names
}

// ===========================================================================
// Tests
// Trace: features/field_validation.feature
// ===========================================================================

// INLINE_TEST_REQUIRED: tests access private AppState fields and storage internals for validation testing
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use vauchi_core::TrustLevel;

    fn create_test_state() -> (AppState, TempDir) {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let state = AppState::new(temp_dir.path()).expect("Failed to create state");
        (state, temp_dir)
    }

    fn create_state_with_identity() -> (AppState, TempDir) {
        let (mut state, temp_dir) = create_test_state();
        state
            .create_identity("Test User")
            .expect("Failed to create identity");
        (state, temp_dir)
    }

    // @scenario: field_validation:User validates a contact field
    #[test]
    fn test_validate_field_creates_record() {
        let (state, _temp) = create_state_with_identity();

        let identity = state.identity.as_ref().unwrap();
        let my_id = hex::encode(identity.signing_public_key());

        // Create a validation directly via storage
        let validation =
            ProfileValidation::create_signed(identity, "email", "alice@example.com", "contact-123");

        state
            .storage
            .save_validation(&validation)
            .expect("Failed to save validation");

        // Verify it was stored
        let count = state
            .storage
            .count_validations_for_field("contact-123", "email")
            .expect("Failed to count");

        assert_eq!(count, 1);

        // Verify we can load it back
        let loaded = state
            .storage
            .load_validations_for_field("contact-123", "email")
            .expect("Failed to load");

        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].validator_id(), my_id);
        assert_eq!(loaded[0].field_value(), "alice@example.com");
    }

    // @scenario: field_validation:Validation trust levels
    #[test]
    fn test_validation_status_shows_correct_trust_level() {
        let (state, _temp) = create_state_with_identity();
        let identity = state.identity.as_ref().unwrap();

        // No validations = Unverified
        let validations = state
            .storage
            .load_validations_for_field("contact-123", "phone")
            .expect("Failed to load");

        let status =
            ValidationStatus::from_validations(&validations, "+1234567890", None, &HashSet::new());

        assert_eq!(status.count, 0);
        assert_eq!(status.trust_level, TrustLevel::Unverified);

        // 1 validation = LowConfidence
        let validation =
            ProfileValidation::create_signed(identity, "phone", "+1234567890", "contact-123");
        state
            .storage
            .save_validation(&validation)
            .expect("Failed to save");

        let validations = state
            .storage
            .load_validations_for_field("contact-123", "phone")
            .expect("Failed to load");

        let my_id = hex::encode(identity.signing_public_key());
        let status = ValidationStatus::from_validations(
            &validations,
            "+1234567890",
            Some(&my_id),
            &HashSet::new(),
        );

        assert_eq!(status.count, 1);
        assert_eq!(status.trust_level, TrustLevel::LowConfidence);
        assert!(status.validated_by_me);
    }

    // @scenario: field_validation:User revokes a validation
    #[test]
    fn test_revoke_validation() {
        let (state, _temp) = create_state_with_identity();
        let identity = state.identity.as_ref().unwrap();
        let my_id = hex::encode(identity.signing_public_key());

        // Create validation
        let validation = ProfileValidation::create_signed(
            identity,
            "website",
            "https://alice.dev",
            "contact-456",
        );
        state
            .storage
            .save_validation(&validation)
            .expect("Failed to save");

        // Verify it exists
        assert_eq!(
            state
                .storage
                .count_validations_for_field("contact-456", "website")
                .unwrap(),
            1
        );

        // Revoke it
        let deleted = state
            .storage
            .delete_validation("contact-456", "website", &my_id)
            .expect("Failed to delete");

        assert!(deleted);

        // Verify it's gone
        assert_eq!(
            state
                .storage
                .count_validations_for_field("contact-456", "website")
                .unwrap(),
            0
        );
    }

    // @scenario: field_validation:User validates a contact field
    #[test]
    fn test_list_my_validations() {
        let (state, _temp) = create_state_with_identity();
        let identity = state.identity.as_ref().unwrap();
        let my_id = hex::encode(identity.signing_public_key());

        // Create validations for different fields
        let v1 =
            ProfileValidation::create_signed(identity, "email", "bob@example.com", "contact-1");
        let v2 = ProfileValidation::create_signed(identity, "phone", "+9876543210", "contact-2");

        state.storage.save_validation(&v1).expect("Failed to save");
        state.storage.save_validation(&v2).expect("Failed to save");

        // Load all my validations
        let mine = state
            .storage
            .load_validations_by_validator(&my_id)
            .expect("Failed to load");

        assert_eq!(mine.len(), 2);
    }

    // @scenario: field_validation:Validation trust levels
    #[test]
    fn test_build_known_names_map_empty() {
        let (state, _temp) = create_state_with_identity();
        let names = build_known_names_map(&state);
        // No contacts added, so map should be empty
        assert!(names.is_empty());
    }
}
