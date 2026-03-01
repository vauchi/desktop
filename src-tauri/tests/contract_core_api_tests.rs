// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Contract tests: Desktop's expectations of vauchi-core API (PI-04).
//!
//! These tests assert the shape and behavior of vauchi-core types as
//! consumed by the Tauri desktop backend. If core changes in a way that
//! breaks these contracts, these tests fail BEFORE the desktop ships.
//!
//! Consumer: vauchi-desktop
//! Provider: vauchi-core

use vauchi_core::{Contact, ContactCard, ContactField, FieldType, Identity, Storage, SymmetricKey};

// ============================================================
// Storage contracts (same as TUI — shared low-level API)
// ============================================================

#[test]
fn contract_storage_open_with_symmetric_key() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let key = SymmetricKey::generate();
    let storage = Storage::open(db_path.to_str().unwrap(), key);
    assert!(storage.is_ok());
}

#[test]
fn contract_storage_save_and_load_own_card() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let key = SymmetricKey::generate();
    let storage = Storage::open(db_path.to_str().unwrap(), key).unwrap();

    let mut card = ContactCard::new("DesktopTest");
    card.add_field(ContactField::new(FieldType::Email, "Work", "desk@test.com"))
        .unwrap();
    storage.save_own_card(&card).unwrap();

    let loaded = storage.load_own_card().unwrap();
    assert!(loaded.is_some());
    let loaded_card = loaded.unwrap();
    assert_eq!(loaded_card.display_name(), "DesktopTest");
    assert_eq!(loaded_card.fields().len(), 1);
    assert_eq!(loaded_card.fields()[0].value(), "desk@test.com");
}

#[test]
fn contract_storage_list_contacts_empty() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let key = SymmetricKey::generate();
    let storage = Storage::open(db_path.to_str().unwrap(), key).unwrap();

    let contacts = storage.list_contacts().unwrap();
    assert!(contacts.is_empty());
}

#[test]
fn contract_storage_search_contacts() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let key = SymmetricKey::generate();
    let storage = Storage::open(db_path.to_str().unwrap(), key).unwrap();

    let results = storage.search_contacts("nonexistent").unwrap();
    assert!(results.is_empty());
}

// ============================================================
// Identity contracts
// ============================================================

#[test]
fn contract_identity_create_and_accessors() {
    let identity = Identity::create("DesktopUser");
    assert_eq!(identity.display_name(), "DesktopUser");
    assert!(!identity.public_id().is_empty());
    assert!(!identity.device_id().is_empty());
    assert!(!identity.signing_public_key().is_empty());
}

#[test]
fn contract_identity_x3dh_keypair_exists() {
    // allow(zero_assertions): Compile-time shape check — verifies x3dh_keypair() exists
    let identity = Identity::create("DesktopUser");
    let _keypair = identity.x3dh_keypair();
}

// ============================================================
// ContactCard contracts (desktop-specific: field mutation)
// ============================================================

#[test]
fn contract_contact_card_add_and_remove_field() {
    let mut card = ContactCard::new("DesktopCard");
    let field = ContactField::new(FieldType::Phone, "Home", "+9876543210");
    card.add_field(field).unwrap();
    assert_eq!(card.fields().len(), 1);

    let field_id = card.fields()[0].id().to_string();
    card.remove_field(&field_id).unwrap();
    assert!(card.fields().is_empty());
}

#[test]
fn contract_contact_card_field_has_id() {
    let mut card = ContactCard::new("DesktopCard");
    card.add_field(ContactField::new(
        FieldType::Website,
        "Blog",
        "https://example.com",
    ))
    .unwrap();

    let field = &card.fields()[0];
    assert!(!field.id().is_empty());
    assert_eq!(field.field_type(), FieldType::Website);
    assert_eq!(field.label(), "Blog");
    assert_eq!(field.value(), "https://example.com");
}

#[test]
fn contract_contact_card_serde_roundtrip() {
    let mut card = ContactCard::new("DesktopCard");
    card.add_field(ContactField::new(FieldType::Social, "Twitter", "@test"))
        .unwrap();

    let json = serde_json::to_string(&card).unwrap();
    let decoded: ContactCard = serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.display_name(), "DesktopCard");
    assert_eq!(decoded.fields().len(), 1);
    assert_eq!(decoded.fields()[0].field_type(), FieldType::Social);
}

// ============================================================
// FieldType contracts
// ============================================================

#[test]
fn contract_field_type_all_six_variants_exist() {
    let types = [
        FieldType::Phone,
        FieldType::Email,
        FieldType::Address,
        FieldType::Website,
        FieldType::Social,
        FieldType::Custom,
    ];
    assert_eq!(types.len(), 6);
}

// ============================================================
// SymmetricKey contracts
// ============================================================

#[test]
fn contract_symmetric_key_generate_32_bytes() {
    let key = SymmetricKey::generate();
    assert_eq!(key.as_bytes().len(), 32);
}

#[test]
fn contract_symmetric_key_from_bytes_roundtrip() {
    let bytes = [0x42; 32];
    let key = SymmetricKey::from_bytes(bytes);
    assert_eq!(key.as_bytes(), &bytes);
}

// ============================================================
// Contact accessors contracts
// ============================================================

#[test]
fn contract_contact_accessors_compile() {
    // Desktop uses these Contact methods — compile-time shape assertion
    fn _assert_contact_shape(c: &Contact) {
        let _: &str = c.id();
        let _: &str = c.display_name();
        let _: &ContactCard = c.card();
        let _: &[u8; 32] = c.public_key();
        let _: bool = c.is_hidden();
        let _: bool = c.is_blocked();
    }
}

// ============================================================
// Delivery contracts (SP-12b)
// ============================================================

#[test]
fn contract_delivery_storage_count_by_status() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let key = SymmetricKey::generate();
    let storage = Storage::open(db_path.to_str().unwrap(), key).unwrap();

    use vauchi_core::storage::DeliveryStatus;
    let count = storage
        .count_deliveries_by_status(&DeliveryStatus::Queued)
        .unwrap();
    assert_eq!(count, 0, "Fresh storage should have zero queued deliveries");
}

#[test]
fn contract_delivery_storage_get_all_records_empty() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let key = SymmetricKey::generate();
    let storage = Storage::open(db_path.to_str().unwrap(), key).unwrap();

    let records = storage.get_all_delivery_records().unwrap();
    assert!(
        records.is_empty(),
        "Fresh storage should have no delivery records"
    );
}

#[test]
fn contract_delivery_storage_get_pending_empty() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let key = SymmetricKey::generate();
    let storage = Storage::open(db_path.to_str().unwrap(), key).unwrap();

    let pending = storage.get_pending_deliveries().unwrap();
    assert!(
        pending.is_empty(),
        "Fresh storage should have no pending deliveries"
    );
}

#[test]
fn contract_delivery_service_cleanup_on_empty_storage() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let key = SymmetricKey::generate();
    let storage = Storage::open(db_path.to_str().unwrap(), key).unwrap();

    let service = vauchi_core::delivery::DeliveryService::new();
    let result = service.run_cleanup(&storage).unwrap();
    assert_eq!(result.expired, 0);
    assert_eq!(result.cleaned_up, 0);
}

#[test]
fn contract_delivery_retry_scheduler_tick_on_empty_storage() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let key = SymmetricKey::generate();
    let storage = Storage::open(db_path.to_str().unwrap(), key).unwrap();

    let scheduler = vauchi_core::delivery::RetryScheduler::new();
    let result = scheduler.tick(&storage).unwrap();
    assert_eq!(result.due, 0);
    assert_eq!(result.rescheduled, 0);
    assert_eq!(result.expired, 0);
    assert!(result.ready_ids.is_empty());
}

#[test]
fn contract_delivery_connectivity_diagnostics_run() {
    let diagnostics = vauchi_core::delivery::ConnectivityDiagnostics::new();
    let report = diagnostics.run().unwrap();
    assert_eq!(report.offline_queue_depth, 0);
    assert_eq!(report.pending_retries, 0);
}

#[test]
fn contract_delivery_failure_to_user_message_known_reason() {
    let msg = vauchi_core::delivery::failure_to_user_message("connection_timeout");
    assert!(
        msg.contains("relay server"),
        "Known reason should produce specific message, got: {}",
        msg
    );
}

#[test]
fn contract_delivery_failure_to_user_message_unknown_reason() {
    let msg = vauchi_core::delivery::failure_to_user_message("something_random");
    assert!(
        !msg.is_empty(),
        "Unknown reason should still produce a message"
    );
}

#[test]
fn contract_delivery_create_and_count_record() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let key = SymmetricKey::generate();
    let storage = Storage::open(db_path.to_str().unwrap(), key).unwrap();

    use vauchi_core::storage::{DeliveryRecord, DeliveryStatus};

    let record = DeliveryRecord {
        message_id: "msg-001".to_string(),
        recipient_id: "alice".to_string(),
        status: DeliveryStatus::Queued,
        created_at: 1000,
        updated_at: 1000,
        expires_at: None,
    };
    storage.create_delivery_record(&record).unwrap();

    let count = storage
        .count_deliveries_by_status(&DeliveryStatus::Queued)
        .unwrap();
    assert_eq!(count, 1, "Should have exactly one queued delivery");

    let all = storage.get_all_delivery_records().unwrap();
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].message_id, "msg-001");
    assert_eq!(all[0].recipient_id, "alice");
}

// ============================================================
// Exchange session type contracts (compile-time)
// ============================================================
// NOTE: Desktop exchange code needs updating to match current core API.
// Exchange contract tests are deferred until desktop/core exchange
// API alignment is resolved (pre-existing compilation issue).
