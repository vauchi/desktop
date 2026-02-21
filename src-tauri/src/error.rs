// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Typed Command Errors
//!
//! Replaces `Result<_, String>` across all Tauri commands with a structured
//! error enum that implements `Serialize` for Tauri IPC.

use std::fmt;

use serde::Serialize;

/// Error type for all Tauri commands.
///
/// Each variant maps to a category of failure that can occur across the
/// desktop app's IPC surface. Implements `Serialize` so Tauri can send
/// structured error data to the frontend.
#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum CommandError {
    /// Database or storage layer failures.
    Storage(String),
    /// Identity not found or identity operation failed.
    Identity(String),
    /// Contact exchange failures (QR, key agreement, session state).
    Exchange(String),
    /// Contact not found or contact operation failed.
    Contact(String),
    /// Contact card field operations (not found, invalid type).
    Card(String),
    /// Backup/restore failures (encryption, decryption, base64).
    Backup(String),
    /// Configuration errors (relay URL, content settings, serialization).
    Config(String),
    /// Network errors (WebSocket, timeout, relay connection).
    Network(String),
    /// Input validation failures (empty fields, bad format, weak password).
    Validation(String),
    /// Device linking/management failures.
    Device(String),
    /// Authentication/duress PIN errors.
    Auth(String),
    /// GDPR/privacy operation failures.
    Privacy(String),
}

impl fmt::Display for CommandError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CommandError::Storage(msg) => write!(f, "Storage error: {}", msg),
            CommandError::Identity(msg) => write!(f, "Identity error: {}", msg),
            CommandError::Exchange(msg) => write!(f, "Exchange error: {}", msg),
            CommandError::Contact(msg) => write!(f, "Contact error: {}", msg),
            CommandError::Card(msg) => write!(f, "Card error: {}", msg),
            CommandError::Backup(msg) => write!(f, "Backup error: {}", msg),
            CommandError::Config(msg) => write!(f, "Config error: {}", msg),
            CommandError::Network(msg) => write!(f, "Network error: {}", msg),
            CommandError::Validation(msg) => write!(f, "Validation error: {}", msg),
            CommandError::Device(msg) => write!(f, "Device error: {}", msg),
            CommandError::Auth(msg) => write!(f, "Auth error: {}", msg),
            CommandError::Privacy(msg) => write!(f, "Privacy error: {}", msg),
        }
    }
}

impl std::error::Error for CommandError {}

// === From conversions for common upstream error types ===

impl From<vauchi_core::StorageError> for CommandError {
    fn from(e: vauchi_core::StorageError) -> Self {
        CommandError::Storage(e.to_string())
    }
}

impl From<anyhow::Error> for CommandError {
    fn from(e: anyhow::Error) -> Self {
        CommandError::Storage(e.to_string())
    }
}

impl From<serde_json::Error> for CommandError {
    fn from(e: serde_json::Error) -> Self {
        CommandError::Config(e.to_string())
    }
}

impl From<std::io::Error> for CommandError {
    fn from(e: std::io::Error) -> Self {
        CommandError::Storage(e.to_string())
    }
}

impl From<base64::DecodeError> for CommandError {
    fn from(e: base64::DecodeError) -> Self {
        CommandError::Backup(format!("Invalid base64: {}", e))
    }
}

impl From<hex::FromHexError> for CommandError {
    fn from(e: hex::FromHexError) -> Self {
        CommandError::Validation(format!("Invalid hex: {}", e))
    }
}

// ===========================================================================
// Tests
// Trace: desktop typed error refactoring
// ===========================================================================

// INLINE_TEST_REQUIRED: tests verify From impls and Serialize output for CommandError which require access to the private enum internals
#[cfg(test)]
mod tests {
    use super::*;

    // === Display Tests ===

    #[test]
    fn test_display_storage_error_includes_kind_and_message() {
        let err = CommandError::Storage("database locked".to_string());
        let display = format!("{}", err);
        assert_eq!(display, "Storage error: database locked");
    }

    #[test]
    fn test_display_identity_error_includes_kind_and_message() {
        let err = CommandError::Identity("not found".to_string());
        let display = format!("{}", err);
        assert_eq!(display, "Identity error: not found");
    }

    #[test]
    fn test_display_exchange_error_includes_kind_and_message() {
        let err = CommandError::Exchange("QR expired".to_string());
        let display = format!("{}", err);
        assert_eq!(display, "Exchange error: QR expired");
    }

    #[test]
    fn test_display_contact_error_includes_kind_and_message() {
        let err = CommandError::Contact("not found".to_string());
        let display = format!("{}", err);
        assert_eq!(display, "Contact error: not found");
    }

    #[test]
    fn test_display_card_error_includes_kind_and_message() {
        let err = CommandError::Card("field not found".to_string());
        let display = format!("{}", err);
        assert_eq!(display, "Card error: field not found");
    }

    #[test]
    fn test_display_backup_error_includes_kind_and_message() {
        let err = CommandError::Backup("decryption failed".to_string());
        let display = format!("{}", err);
        assert_eq!(display, "Backup error: decryption failed");
    }

    #[test]
    fn test_display_config_error_includes_kind_and_message() {
        let err = CommandError::Config("invalid URL".to_string());
        let display = format!("{}", err);
        assert_eq!(display, "Config error: invalid URL");
    }

    #[test]
    fn test_display_network_error_includes_kind_and_message() {
        let err = CommandError::Network("connection timed out".to_string());
        let display = format!("{}", err);
        assert_eq!(display, "Network error: connection timed out");
    }

    #[test]
    fn test_display_validation_error_includes_kind_and_message() {
        let err = CommandError::Validation("name too long".to_string());
        let display = format!("{}", err);
        assert_eq!(display, "Validation error: name too long");
    }

    #[test]
    fn test_display_device_error_includes_kind_and_message() {
        let err = CommandError::Device("link expired".to_string());
        let display = format!("{}", err);
        assert_eq!(display, "Device error: link expired");
    }

    #[test]
    fn test_display_auth_error_includes_kind_and_message() {
        let err = CommandError::Auth("wrong PIN".to_string());
        let display = format!("{}", err);
        assert_eq!(display, "Auth error: wrong PIN");
    }

    #[test]
    fn test_display_privacy_error_includes_kind_and_message() {
        let err = CommandError::Privacy("export failed".to_string());
        let display = format!("{}", err);
        assert_eq!(display, "Privacy error: export failed");
    }

    // === All variants produce distinct display strings ===

    #[test]
    fn test_all_variants_produce_distinct_display_prefixes() {
        let variants: Vec<CommandError> = vec![
            CommandError::Storage("x".into()),
            CommandError::Identity("x".into()),
            CommandError::Exchange("x".into()),
            CommandError::Contact("x".into()),
            CommandError::Card("x".into()),
            CommandError::Backup("x".into()),
            CommandError::Config("x".into()),
            CommandError::Network("x".into()),
            CommandError::Validation("x".into()),
            CommandError::Device("x".into()),
            CommandError::Auth("x".into()),
            CommandError::Privacy("x".into()),
        ];

        let displays: Vec<String> = variants.iter().map(|v| format!("{}", v)).collect();
        let unique: std::collections::HashSet<&String> = displays.iter().collect();
        assert_eq!(
            unique.len(),
            displays.len(),
            "All variants must produce unique display strings"
        );
    }

    // === Serialize Tests ===

    #[test]
    fn test_serialize_produces_tagged_json_with_kind_and_message() {
        let err = CommandError::Storage("db error".to_string());
        let json = serde_json::to_string(&err).expect("serialization must succeed");
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("must be valid JSON");

        assert_eq!(parsed["kind"], "Storage");
        assert_eq!(parsed["message"], "db error");
    }

    #[test]
    fn test_serialize_all_variants_have_kind_field() {
        let variants: Vec<(&str, CommandError)> = vec![
            ("Storage", CommandError::Storage("a".into())),
            ("Identity", CommandError::Identity("a".into())),
            ("Exchange", CommandError::Exchange("a".into())),
            ("Contact", CommandError::Contact("a".into())),
            ("Card", CommandError::Card("a".into())),
            ("Backup", CommandError::Backup("a".into())),
            ("Config", CommandError::Config("a".into())),
            ("Network", CommandError::Network("a".into())),
            ("Validation", CommandError::Validation("a".into())),
            ("Device", CommandError::Device("a".into())),
            ("Auth", CommandError::Auth("a".into())),
            ("Privacy", CommandError::Privacy("a".into())),
        ];

        for (expected_kind, err) in variants {
            let json = serde_json::to_string(&err).expect("serialization must succeed");
            let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
            assert_eq!(
                parsed["kind"].as_str().unwrap(),
                expected_kind,
                "Variant {:?} must serialize with kind={}",
                err,
                expected_kind
            );
        }
    }

    // === From conversion tests ===

    #[test]
    fn test_from_storage_error_produces_storage_variant() {
        let storage_err = vauchi_core::StorageError::NotFound("label xyz".to_string());
        let cmd_err: CommandError = storage_err.into();
        match cmd_err {
            CommandError::Storage(msg) => {
                assert!(
                    msg.contains("Not found"),
                    "Storage error message should contain original text, got: {}",
                    msg
                );
            }
            other => panic!("Expected Storage variant, got {:?}", other),
        }
    }

    #[test]
    fn test_from_anyhow_error_produces_storage_variant() {
        let anyhow_err = anyhow::anyhow!("something went wrong");
        let cmd_err: CommandError = anyhow_err.into();
        match cmd_err {
            CommandError::Storage(msg) => {
                assert!(
                    msg.contains("something went wrong"),
                    "Anyhow message should be preserved, got: {}",
                    msg
                );
            }
            other => panic!("Expected Storage variant, got {:?}", other),
        }
    }

    #[test]
    fn test_from_serde_json_error_produces_config_variant() {
        let json_err = serde_json::from_str::<serde_json::Value>("invalid json {{{").unwrap_err();
        let cmd_err: CommandError = json_err.into();
        match cmd_err {
            CommandError::Config(msg) => {
                assert!(!msg.is_empty(), "JSON error message should not be empty");
            }
            other => panic!("Expected Config variant, got {:?}", other),
        }
    }

    #[test]
    fn test_from_io_error_produces_storage_variant() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file missing");
        let cmd_err: CommandError = io_err.into();
        match cmd_err {
            CommandError::Storage(msg) => {
                assert!(
                    msg.contains("file missing"),
                    "IO error message should be preserved, got: {}",
                    msg
                );
            }
            other => panic!("Expected Storage variant, got {:?}", other),
        }
    }

    #[test]
    fn test_from_base64_decode_error_produces_backup_variant() {
        use base64::{engine::general_purpose::STANDARD, Engine};
        let b64_err = STANDARD.decode("!!!not-base64!!!").unwrap_err();
        let cmd_err: CommandError = b64_err.into();
        match cmd_err {
            CommandError::Backup(msg) => {
                assert!(
                    msg.contains("base64"),
                    "Base64 error should mention base64, got: {}",
                    msg
                );
            }
            other => panic!("Expected Backup variant, got {:?}", other),
        }
    }

    #[test]
    fn test_from_hex_error_produces_validation_variant() {
        let hex_err = hex::decode("ZZ").unwrap_err();
        let cmd_err: CommandError = hex_err.into();
        match cmd_err {
            CommandError::Validation(msg) => {
                assert!(
                    msg.contains("hex"),
                    "Hex error should mention hex, got: {}",
                    msg
                );
            }
            other => panic!("Expected Validation variant, got {:?}", other),
        }
    }

    // === std::error::Error impl ===

    #[test]
    fn test_implements_std_error_trait() {
        let err = CommandError::Storage("test".to_string());
        // This compiles only if CommandError implements std::error::Error
        let _: &dyn std::error::Error = &err;
    }

    // === Debug impl ===

    #[test]
    fn test_debug_output_is_meaningful() {
        let err = CommandError::Network("timeout".to_string());
        let debug = format!("{:?}", err);
        assert!(
            debug.contains("Network"),
            "Debug should contain variant name, got: {}",
            debug
        );
        assert!(
            debug.contains("timeout"),
            "Debug should contain message, got: {}",
            debug
        );
    }
}
