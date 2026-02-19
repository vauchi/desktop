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
// Exchange session type contracts (compile-time)
// ============================================================
// NOTE: Desktop exchange code needs updating to match current core API.
// Exchange contract tests are deferred until desktop/core exchange
// API alignment is resolved (pre-existing compilation issue).
