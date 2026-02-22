// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Vauchi Desktop Application
//!
//! Tauri-based desktop app for Vauchi.

mod commands;
mod relay;
mod state;
mod test_server;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use tauri::Manager;

use state::AppState;

/// Initialize and run the Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Resolve data directory
            // Priority: VAUCHI_DATA_DIR env var > system data dir
            let data_dir = std::env::var("VAUCHI_DATA_DIR")
                .ok()
                .filter(|s| !s.is_empty())
                .map(PathBuf::from)
                .unwrap_or_else(|| {
                    dirs::data_dir()
                        .unwrap_or_else(|| PathBuf::from("."))
                        .join("vauchi")
                });

            // Initialize i18n from bundled resource files
            let resource_dir = app
                .path()
                .resource_dir()
                .map(|d| d.join("locales"))
                .unwrap_or_else(|_| data_dir.join("locales"));
            if let Err(e) = vauchi_core::i18n::init(&resource_dir) {
                eprintln!(
                    "Warning: Failed to load locale files from {:?}: {}",
                    resource_dir, e
                );
            }

            // Initialize app state
            let app_state = AppState::new(&data_dir).expect("Failed to initialize app state");

            // Start test HTTP server if VAUCHI_TEST_PORT is set
            // The test server gets its own AppState instance pointing to the same data dir
            if let Ok(port_str) = std::env::var("VAUCHI_TEST_PORT") {
                if let Ok(port) = port_str.parse::<u16>() {
                    let data_dir_clone = data_dir.clone();
                    std::thread::spawn(move || {
                        // Create a separate AppState for the test server
                        // Both instances share the same SQLite database (with proper locking)
                        match AppState::new(&data_dir_clone) {
                            Ok(test_state) => {
                                let test_state = Arc::new(Mutex::new(test_state));
                                match test_server::start_test_server(test_state, port) {
                                    Ok(actual_port) => {
                                        println!("Test server started on port {}", actual_port);
                                    }
                                    Err(e) => {
                                        eprintln!("Failed to start test server: {}", e);
                                    }
                                }
                            }
                            Err(e) => {
                                eprintln!("Failed to create test state: {}", e);
                            }
                        }
                    });
                }
            }

            app.manage(Mutex::new(app_state));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::identity::has_identity,
            commands::identity::create_identity,
            commands::identity::get_identity_info,
            commands::identity::update_display_name,
            commands::card::get_card,
            commands::card::add_field,
            commands::card::remove_field,
            commands::card::update_field,
            commands::contacts::list_contacts,
            commands::contacts::list_contacts_paginated,
            commands::contacts::search_contacts,
            commands::contacts::get_contact,
            commands::contacts::remove_contact,
            commands::contacts::get_contact_fingerprint,
            commands::contacts::verify_contact,
            commands::contacts::trust_contact,
            commands::contacts::untrust_contact,
            commands::contacts::trusted_contact_count,
            commands::exchange::start_exchange,
            commands::exchange::process_scanned_qr,
            commands::exchange::confirm_peer_scan,
            commands::exchange::complete_exchange,
            commands::backup::export_backup,
            commands::backup::import_backup,
            commands::backup::check_password_strength,
            commands::visibility::get_visibility_rules,
            commands::visibility::set_field_visibility,
            commands::visibility::get_contacts_for_visibility,
            commands::visibility::get_field_viewers,
            commands::labels::list_labels,
            commands::labels::create_label,
            commands::labels::get_label,
            commands::labels::rename_label,
            commands::labels::delete_label,
            commands::labels::add_contact_to_label,
            commands::labels::remove_contact_from_label,
            commands::labels::get_labels_for_contact,
            commands::labels::set_label_field_visibility,
            commands::labels::set_contact_field_override,
            commands::labels::remove_contact_field_override,
            commands::labels::get_suggested_labels,
            commands::devices::list_devices,
            commands::devices::get_current_device,
            commands::devices::generate_device_link,
            commands::devices::generate_device_link_qr,
            commands::devices::join_device,
            commands::devices::finish_join_device,
            commands::devices::get_join_confirmation_code,
            commands::devices::complete_device_link,
            commands::devices::prepare_device_confirmation,
            commands::devices::confirm_device_link_approved,
            commands::devices::deny_device_link,
            commands::devices::revoke_device,
            commands::devices::generate_multipart_qr,
            commands::devices::relay_listen_for_request,
            commands::devices::relay_send_response,
            commands::devices::relay_join_via_relay,
            commands::recovery::get_recovery_settings,
            commands::recovery::create_recovery_claim,
            commands::recovery::create_recovery_voucher,
            commands::recovery::check_recovery_claim,
            commands::recovery::parse_recovery_claim,
            commands::actions::open_contact_field,
            commands::actions::get_field_action,
            commands::sync::sync,
            commands::sync::get_sync_status,
            commands::sync::get_relay_url,
            commands::sync::set_relay_url,
            commands::content::check_content_updates,
            commands::content::apply_content_updates,
            commands::content::get_content_settings,
            commands::content::set_content_updates_enabled,
            commands::content::set_content_url,
            commands::content::get_social_networks,
            // Theme commands
            commands::theme::get_available_themes,
            commands::theme::get_theme,
            commands::theme::get_default_theme_id,
            // i18n commands
            commands::i18n::get_locales,
            commands::i18n::get_localized_string,
            commands::i18n::get_localized_string_with_args,
            commands::i18n::get_locale_strings,
            // Help commands
            commands::help::get_help_categories,
            commands::help::get_all_faqs,
            commands::help::get_category_faqs,
            commands::help::get_faq,
            commands::help::search_help,
            commands::help::get_all_faqs_localized,
            commands::help::get_category_faqs_localized,
            commands::help::get_faq_localized,
            commands::help::search_help_localized,
            // Aha moment commands
            commands::aha::check_aha_moment,
            commands::aha::check_aha_moment_with_context,
            commands::aha::check_aha_moment_localized,
            // Validation commands
            commands::validation::validate_contact_field,
            commands::validation::get_field_validation_status,
            commands::validation::revoke_field_validation,
            commands::validation::get_field_validation_count,
            commands::validation::list_my_validations,
            // GDPR commands
            commands::gdpr::export_gdpr_data,
            commands::gdpr::schedule_account_deletion,
            commands::gdpr::cancel_account_deletion,
            commands::gdpr::get_deletion_state,
            commands::gdpr::grant_consent,
            commands::gdpr::revoke_consent,
            commands::gdpr::get_consent_records,
            commands::gdpr::execute_account_deletion,
            commands::gdpr::panic_shred,
            // Emergency broadcast commands
            commands::emergency::get_emergency_config,
            commands::emergency::save_emergency_config,
            commands::emergency::delete_emergency_config,
            // Auth & duress commands
            commands::auth::setup_app_password,
            commands::auth::authenticate,
            commands::auth::setup_duress_pin,
            commands::auth::disable_duress,
            commands::auth::get_duress_status,
            commands::auth::get_duress_settings,
            commands::auth::save_duress_settings,
            // Tor commands
            commands::tor::get_tor_config,
            commands::tor::save_tor_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
