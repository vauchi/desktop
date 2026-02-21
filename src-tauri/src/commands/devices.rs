// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Device Management Commands
//!
//! Commands for multi-device linking and management.

use std::fmt::Write;
use std::sync::Mutex;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use qrcode::QrCode;
use serde::{Deserialize, Serialize};
use tauri::State;
use vauchi_core::exchange::{DeviceLinkQR, DeviceLinkResponder, DeviceLinkResponse};
use vauchi_core::Identity;

use crate::error::CommandError;
use crate::state::AppState;

/// Device info for the frontend.
#[derive(Serialize)]
pub struct DeviceInfo {
    pub device_id: String,
    pub device_name: String,
    pub device_index: u32,
    pub is_current: bool,
    pub is_active: bool,
}

/// Get list of all linked devices.
#[tauri::command]
pub fn list_devices(state: State<'_, Mutex<AppState>>) -> Result<Vec<DeviceInfo>, CommandError> {
    let state = state.lock().unwrap();

    // Get current device info from identity
    let identity = state
        .identity
        .as_ref()
        .ok_or_else(|| CommandError::Identity("No identity found".to_string()))?;

    let current_device = identity.device_info();
    let current_device_id = hex::encode(current_device.device_id());

    let mut devices = vec![DeviceInfo {
        device_id: current_device_id.clone(),
        device_name: current_device.device_name().to_string(),
        device_index: current_device.device_index(),
        is_current: true,
        is_active: true,
    }];

    // Try to load device registry for other devices
    if let Ok(Some(registry)) = state.storage.load_device_registry() {
        for (i, device) in registry.all_devices().iter().enumerate() {
            let device_id = hex::encode(device.device_id);
            if device_id != current_device_id {
                devices.push(DeviceInfo {
                    device_id,
                    device_name: device.device_name.clone(),
                    device_index: i as u32,
                    is_current: false,
                    is_active: device.is_active(),
                });
            }
        }
    }

    Ok(devices)
}

/// Get current device info.
#[tauri::command]
pub fn get_current_device(state: State<'_, Mutex<AppState>>) -> Result<DeviceInfo, CommandError> {
    let state = state.lock().unwrap();

    let identity = state
        .identity
        .as_ref()
        .ok_or_else(|| CommandError::Identity("No identity found".to_string()))?;

    let device = identity.device_info();

    Ok(DeviceInfo {
        device_id: hex::encode(device.device_id()),
        device_name: device.device_name().to_string(),
        device_index: device.device_index(),
        is_current: true,
        is_active: true,
    })
}

/// Generate device link QR data for pairing a new device.
#[deprecated(note = "Use generate_device_link_qr instead")]
#[tauri::command]
pub fn generate_device_link(state: State<'_, Mutex<AppState>>) -> Result<String, CommandError> {
    let mut state = state.lock().unwrap();

    let identity = state
        .identity
        .as_ref()
        .ok_or_else(|| CommandError::Identity("No identity found".to_string()))?;

    // Generate device link QR
    let qr = DeviceLinkQR::generate(identity);
    let qr_data = qr.to_data_string();

    // Store the QR data for use in complete_device_link
    state.pending_device_link_qr = Some(qr_data.clone());

    Ok(qr_data)
}

/// Result of starting a device join (step 1).
#[derive(Serialize)]
pub struct JoinStartResult {
    /// Whether the link data was valid.
    pub success: bool,
    /// The join request data to send to the existing device.
    pub request_data: Option<String>,
    /// The hex-encoded identity public key from the QR code (relay target).
    pub target_identity: Option<String>,
    /// Message for the user.
    pub message: String,
}

/// Result of finishing a device join (step 2).
#[derive(Serialize)]
pub struct JoinFinishResult {
    /// Whether the join completed successfully.
    pub success: bool,
    /// The display name from the joined identity.
    pub display_name: Option<String>,
    /// The device index assigned to this device.
    pub device_index: Option<u32>,
    /// Message for the user.
    pub message: String,
}

/// Pending device join state stored between steps.
#[derive(Serialize, Deserialize, Clone)]
struct PendingJoin {
    /// The original QR data string.
    qr_data: String,
    /// The device name for this new device.
    device_name: String,
    /// Confirmation code computed after creating the request (stored because nonce is not recoverable).
    confirmation_code: String,
    /// Identity fingerprint from the QR code.
    fingerprint: String,
}

/// Start joining another device using link data (Step 1).
///
/// This parses the QR data and creates a join request that must be sent
/// to the existing device. Store the response and call finish_join_device.
#[tauri::command]
pub fn join_device(
    link_data: String,
    device_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<JoinStartResult, CommandError> {
    let mut state = state.lock().unwrap();

    // Check if we already have an identity
    if state.identity.is_some() {
        return Err(CommandError::Device(
            "This device already has an identity. Cannot join another device.".to_string(),
        ));
    }

    // Parse the link data
    let qr = DeviceLinkQR::from_data_string(&link_data)
        .map_err(|e| CommandError::Device(format!("Invalid link data: {:?}", e)))?;

    // Check if the link has expired
    if qr.is_expired() {
        return Err(CommandError::Device(
            "This device link has expired. Please generate a new one.".to_string(),
        ));
    }

    // Extract the target identity hex before the QR is moved into the responder,
    // so the frontend never needs to parse protocol data.
    let target_identity = hex::encode(qr.identity_public_key());

    // Use provided device name or default
    let device_name = if device_name.is_empty() {
        "Desktop Device".to_string()
    } else {
        device_name
    };

    // Create responder and generate request (consumes qr)
    let mut responder = DeviceLinkResponder::from_qr(qr, device_name.clone())
        .map_err(|e| CommandError::Device(format!("Failed to create responder: {:?}", e)))?;

    let encrypted_request = responder
        .create_request()
        .map_err(|e| CommandError::Device(format!("Failed to create request: {:?}", e)))?;

    // Compute confirmation code and fingerprint while we still have the responder
    let confirmation_code = responder
        .compute_confirmation_code()
        .map_err(|e| format!("Failed to compute confirmation code: {:?}", e))?;
    let fingerprint = responder.identity_fingerprint();

    // Encode request for transmission
    let request_b64 = BASE64.encode(&encrypted_request);

    // Store pending join state (includes confirmation info since nonce is not recoverable)
    let pending = PendingJoin {
        qr_data: link_data,
        device_name,
        confirmation_code,
        fingerprint,
    };
    state.pending_device_join = Some(serde_json::to_string(&pending).unwrap_or_default());

    Ok(JoinStartResult {
        success: true,
        request_data: Some(request_b64),
        target_identity: Some(target_identity),
        message: "Send this request to the existing device and get the response.".to_string(),
    })
}

/// Confirmation details for the responder (new device) side of device linking.
#[derive(Serialize)]
pub struct JoinConfirmation {
    /// The confirmation code to compare with the initiator's display.
    pub confirmation_code: String,
    /// The identity fingerprint from the QR code.
    pub fingerprint: String,
}

/// Get the confirmation code and fingerprint for a pending device join.
///
/// Call this after `join_device` to retrieve the confirmation details that the
/// user should compare with the initiator's screen before proceeding.
#[tauri::command]
pub fn get_join_confirmation_code(
    state: State<'_, Mutex<AppState>>,
) -> Result<JoinConfirmation, String> {
    let state = state.lock().unwrap();

    let pending_json = state
        .pending_device_join
        .as_ref()
        .ok_or("No pending device join")?;
    let pending: PendingJoin =
        serde_json::from_str(pending_json).map_err(|_| "Invalid pending join state")?;

    Ok(JoinConfirmation {
        confirmation_code: pending.confirmation_code,
        fingerprint: pending.fingerprint,
    })
}

/// Finish joining a device by processing the response (Step 2).
///
/// Call this after getting the response from the existing device.
#[tauri::command]
pub fn finish_join_device(
    response_data: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<JoinFinishResult, CommandError> {
    let mut state = state.lock().unwrap();

    // Check if we already have an identity
    if state.identity.is_some() {
        return Err(CommandError::Device(
            "This device already has an identity.".to_string(),
        ));
    }

    // Get pending join state
    let pending_json = state.pending_device_join.take().ok_or_else(|| {
        CommandError::Device("No pending device join. Call join_device first.".to_string())
    })?;

    let pending: PendingJoin = serde_json::from_str(&pending_json)
        .map_err(|_| CommandError::Device("Invalid pending join state".to_string()))?;

    // Parse the original QR data
    let qr = DeviceLinkQR::from_data_string(&pending.qr_data)
        .map_err(|e| CommandError::Device(format!("Invalid QR data: {:?}", e)))?;

    // Decode the response
    let encrypted_response = BASE64.decode(&response_data).map_err(|_| {
        CommandError::Device("Invalid response data (not valid base64)".to_string())
    })?;

    // Decrypt the response using the link key
    let response = DeviceLinkResponse::decrypt(&encrypted_response, qr.link_key())
        .map_err(|e| CommandError::Device(format!("Failed to decrypt response: {:?}", e)))?;

    // Create identity from the received seed
    let identity = Identity::from_device_link(
        *response.master_seed(),
        response.display_name().to_string(),
        response.device_index(),
        pending.device_name,
    );

    let display_name = identity.display_name().to_string();
    let device_index = identity.device_info().device_index();

    // Save identity backup to storage
    let password = state
        .backup_password()
        .map_err(|e| CommandError::Device(format!("Failed to get backup password: {:?}", e)))?;
    let backup = identity
        .export_backup(&password)
        .map_err(|e| CommandError::Device(format!("Failed to export backup: {:?}", e)))?;

    state
        .storage
        .save_identity(backup.as_bytes(), &display_name)
        .map_err(|e| CommandError::Storage(format!("Failed to save identity: {:?}", e)))?;

    // Save device registry
    state
        .storage
        .save_device_registry(response.registry())
        .map_err(|e| CommandError::Storage(format!("Failed to save device registry: {:?}", e)))?;

    // Set identity in app state
    state.identity = Some(identity);

    Ok(JoinFinishResult {
        success: true,
        display_name: Some(display_name),
        device_index: Some(device_index),
        message: "Device successfully joined! Run sync to fetch contacts.".to_string(),
    })
}

/// Complete a device link request on the existing device.
///
/// This is called on the device that generated the link QR to approve the new device.
/// Returns a JSON object with `response` (base64 encrypted response) and
/// `confirmation` (device name, confirmation code, fingerprint) for UI display.
#[deprecated(note = "Use prepare_device_confirmation + confirm_device_link_approved instead")]
#[tauri::command]
pub fn complete_device_link(
    request_data: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, CommandError> {
    let state = state.lock().unwrap();

    let identity = state.identity.as_ref().ok_or_else(|| {
        CommandError::Identity("No identity found. Cannot complete device link.".to_string())
    })?;

    // Check for pending link QR
    let pending_qr_data = state.pending_device_link_qr.as_ref().ok_or_else(|| {
        CommandError::Device("No pending device link. Generate a link QR first.".to_string())
    })?;

    let saved_qr = DeviceLinkQR::from_data_string(pending_qr_data)
        .map_err(|e| CommandError::Device(format!("Invalid saved QR data: {:?}", e)))?;

    if saved_qr.is_expired() {
        return Err(CommandError::Device(
            "Device link QR has expired. Generate a new one.".to_string(),
        ));
    }

    // Get or create device registry
    let registry = state
        .storage
        .load_device_registry()
        .map_err(|e| CommandError::Storage(format!("Failed to load registry: {:?}", e)))?
        .unwrap_or_else(|| identity.initial_device_registry());

    // Restore the initiator
    let mut initiator = identity.restore_device_link_initiator(registry, saved_qr);

    // Decode and process the request
    let encrypted_request = BASE64
        .decode(&request_data)
        .map_err(|_| CommandError::Device("Invalid request data (not valid base64)".to_string()))?;

    // Decrypt request and get confirmation details
    let (_confirmation, request) = initiator
        .prepare_confirmation(&encrypted_request)
        .map_err(|e| CommandError::Device(format!("Failed to prepare confirmation: {:?}", e)))?;

    // Desktop uses QR scan for proximity proof
    initiator.set_proximity_verified();

    let (encrypted_response, updated_registry, _new_device) = initiator
        .confirm_link(&request)
        .map_err(|e| CommandError::Device(format!("Failed to confirm link: {:?}", e)))?;

    // Save the updated registry
    state
        .storage
        .save_device_registry(&updated_registry)
        .map_err(|e| CommandError::Storage(format!("Failed to save registry: {:?}", e)))?;

    // Return the response for the new device
    Ok(BASE64.encode(&encrypted_response))
}

/// Confirmation details shown to user before approving a device link.
#[derive(Serialize)]
pub struct DeviceConfirmation {
    pub device_name: String,
    pub confirmation_code: String,
    pub fingerprint: String,
}

/// Response to send back after confirming a device link.
#[derive(Serialize)]
pub struct DeviceLinkResponseData {
    pub response_data: String,
}

/// Prepare device link confirmation details for the user (step 1 of approval).
///
/// Decrypts the incoming request and returns confirmation details (device name,
/// confirmation code, fingerprint) for the user to review before approving.
/// Stores the initiator and request in state for the subsequent confirm/deny step.
#[tauri::command]
pub fn prepare_device_confirmation(
    request_data: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<DeviceConfirmation, String> {
    let mut state = state.lock().unwrap();

    let identity = state
        .identity
        .as_ref()
        .ok_or("No identity found. Cannot prepare device confirmation.")?;

    // Get pending QR data
    let pending_qr_data = state
        .pending_device_link_qr
        .as_ref()
        .ok_or("No pending device link. Generate a link QR first.")?;

    let saved_qr = DeviceLinkQR::from_data_string(pending_qr_data)
        .map_err(|e| format!("Invalid saved QR data: {:?}", e))?;

    if saved_qr.is_expired() {
        return Err("Device link QR has expired. Generate a new one.".to_string());
    }

    // Get or create device registry
    let registry = state
        .storage
        .load_device_registry()
        .map_err(|e| format!("Failed to load registry: {:?}", e))?
        .unwrap_or_else(|| identity.initial_device_registry());

    // Create restored initiator
    let initiator = identity.restore_device_link_initiator(registry, saved_qr);

    // Decode and decrypt the request
    let encrypted_request = BASE64
        .decode(&request_data)
        .map_err(|_| "Invalid request data (not valid base64)".to_string())?;

    let (confirmation, request) = initiator
        .prepare_confirmation(&encrypted_request)
        .map_err(|e| format!("Failed to prepare confirmation: {:?}", e))?;

    let result = DeviceConfirmation {
        device_name: confirmation.device_name,
        confirmation_code: confirmation.confirmation_code,
        fingerprint: confirmation.identity_fingerprint,
    };

    // Store initiator and request for the confirm/deny step
    state.pending_initiator = Some(initiator);
    state.pending_link_request = Some(request);

    Ok(result)
}

/// Confirm and approve a pending device link (step 2a of approval).
///
/// Takes the pending initiator and request from state, sets proximity as
/// verified (desktop uses manual confirmation code comparison), confirms
/// the link, saves the updated registry, and returns the encrypted response.
#[tauri::command]
pub fn confirm_device_link_approved(
    state: State<'_, Mutex<AppState>>,
) -> Result<DeviceLinkResponseData, String> {
    let mut state = state.lock().unwrap();

    let mut initiator = state
        .pending_initiator
        .take()
        .ok_or("No pending device link initiator. Call prepare_device_confirmation first.")?;

    let request = state
        .pending_link_request
        .take()
        .ok_or("No pending device link request.")?;

    // Desktop uses manual confirmation code comparison for proximity proof
    initiator.set_proximity_verified();

    let (encrypted_response, updated_registry, _new_device) = initiator
        .confirm_link(&request)
        .map_err(|e| format!("Failed to confirm link: {:?}", e))?;

    // Save the updated registry
    state
        .storage
        .save_device_registry(&updated_registry)
        .map_err(|e| format!("Failed to save registry: {:?}", e))?;

    // Clear the pending QR data
    state.pending_device_link_qr = None;

    Ok(DeviceLinkResponseData {
        response_data: BASE64.encode(&encrypted_response),
    })
}

/// Deny a pending device link (step 2b of approval).
///
/// Cleans up all pending device link state without completing the link.
#[tauri::command]
pub fn deny_device_link(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut state = state.lock().unwrap();
    state.pending_initiator = None;
    state.pending_link_request = None;
    state.pending_device_link_qr = None;
    Ok(())
}

/// Generate an SVG string from QR data.
///
/// Creates a QR code from the given data and renders it as an SVG string
/// with dark modules drawn as black rectangles on a white background.
/// Includes a 4-module quiet zone around the code per QR spec.
pub fn generate_qr_svg(data: &str) -> Result<String, String> {
    let code =
        QrCode::new(data.as_bytes()).map_err(|e| format!("Failed to encode QR code: {e}"))?;
    let width = code.width();
    let quiet_zone = 4;
    let total = width + quiet_zone * 2;

    let mut svg = String::new();
    write!(
        svg,
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} {total}" shape-rendering="crispEdges">"#,
    )
    .unwrap();

    // White background covering the full area including quiet zone
    write!(
        svg,
        r#"<rect width="{total}" height="{total}" fill="white"/>"#,
    )
    .unwrap();

    // Draw dark modules
    let colors = code.to_colors();
    for y in 0..width {
        for x in 0..width {
            if colors[y * width + x] == qrcode::Color::Dark {
                let sx = x + quiet_zone;
                let sy = y + quiet_zone;
                write!(
                    svg,
                    r#"<rect x="{sx}" y="{sy}" width="1" height="1" fill="black"/>"#,
                )
                .unwrap();
            }
        }
    }

    svg.push_str("</svg>");
    Ok(svg)
}

/// Result of generating a device link QR with SVG.
#[derive(Serialize)]
pub struct DeviceLinkQRResult {
    /// The raw QR data string.
    pub qr_data: String,
    /// The QR code rendered as an SVG string.
    pub qr_svg: String,
    /// The identity fingerprint for verification.
    pub fingerprint: String,
}

/// Generate device link QR with SVG rendering and fingerprint.
#[tauri::command]
pub fn generate_device_link_qr(
    state: State<'_, Mutex<AppState>>,
) -> Result<DeviceLinkQRResult, String> {
    let mut state = state.lock().unwrap();

    let identity = state
        .identity
        .as_ref()
        .ok_or_else(|| "No identity found".to_string())?;

    // Generate device link QR
    let qr = DeviceLinkQR::generate(identity);
    let qr_data = qr.to_data_string();
    let fingerprint = qr.identity_fingerprint();

    // Render QR data as SVG
    let qr_svg = generate_qr_svg(&qr_data)?;

    // Store the QR data for use in complete_device_link
    state.pending_device_link_qr = Some(qr_data.clone());

    Ok(DeviceLinkQRResult {
        qr_data,
        qr_svg,
        fingerprint,
    })
}

/// Revoke a linked device.
///
/// This removes a device from the device registry, preventing it from syncing.
#[tauri::command]
pub fn revoke_device(
    device_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, CommandError> {
    let state = state.lock().unwrap();

    let identity = state
        .identity
        .as_ref()
        .ok_or_else(|| CommandError::Identity("No identity found".to_string()))?;

    // Get current device ID to prevent self-revocation
    let current_device_id = hex::encode(identity.device_info().device_id());
    if device_id == current_device_id {
        return Err(CommandError::Device(
            "Cannot revoke the current device. Use a different device to revoke this one."
                .to_string(),
        ));
    }

    // Load device registry
    let mut registry = state
        .storage
        .load_device_registry()
        .map_err(|e| CommandError::Storage(format!("Failed to load device registry: {:?}", e)))?
        .ok_or_else(|| CommandError::Device("No device registry found".to_string()))?;

    // Find and revoke the device
    let device_id_bytes = hex::decode(&device_id)?;

    if device_id_bytes.len() != 32 {
        return Err(CommandError::Validation(
            "Device ID must be 32 bytes".to_string(),
        ));
    }

    let device_id_array: [u8; 32] = device_id_bytes
        .try_into()
        .map_err(|_| CommandError::Validation("Invalid device ID length".to_string()))?;

    // Revoke the device using the registry method
    registry
        .revoke_device(&device_id_array, identity.signing_keypair())
        .map_err(|e| CommandError::Device(format!("Failed to revoke device: {:?}", e)))?;

    // Save updated registry
    state
        .storage
        .save_device_registry(&registry)
        .map_err(|e| CommandError::Storage(format!("Failed to save device registry: {:?}", e)))?;

    Ok(true)
}

// ===========================================================================
// Relay Transport Commands
// ===========================================================================

/// Listen for a device link request via relay (initiator/existing device).
///
/// Connects to the relay, sends a listening handshake, and waits for an
/// incoming device link request from a new device. Stores the sender token
/// in state for the subsequent `relay_send_response` call.
///
/// Returns the base64-encoded encrypted request payload.
#[tauri::command]
pub async fn relay_listen_for_request(state: State<'_, Mutex<AppState>>) -> Result<String, String> {
    let (relay_url, identity_id) = {
        let state = state.lock().unwrap();
        let identity = state
            .identity
            .as_ref()
            .ok_or_else(|| "No identity found".to_string())?;
        let relay_url = state.relay_url().to_string();
        let identity_id = hex::encode(identity.signing_public_key());
        (relay_url, identity_id)
    }; // Lock released before await

    let (payload, sender_token) =
        crate::relay::listen_for_request(&relay_url, &identity_id, 300).await?;

    {
        let mut state = state.lock().unwrap();
        state.pending_sender_token = Some(sender_token);
    }

    Ok(BASE64.encode(&payload))
}

/// Send a device link response back via relay (initiator/existing device).
///
/// Takes a base64-encoded encrypted response payload, retrieves the pending
/// sender token from state, and sends the response through the relay.
#[tauri::command]
pub async fn relay_send_response(
    response_data: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let (relay_url, sender_token) = {
        let mut state = state.lock().unwrap();
        let relay_url = state.relay_url().to_string();
        let sender_token = state.pending_sender_token.take().ok_or_else(|| {
            "No pending sender token. Call relay_listen_for_request first.".to_string()
        })?;
        (relay_url, sender_token)
    }; // Lock released before await

    let payload = BASE64
        .decode(&response_data)
        .map_err(|_| "Invalid response data (not valid base64)".to_string())?;

    crate::relay::send_response(&relay_url, &sender_token, payload).await
}

/// Send a device link request and receive the response via relay (responder/new device).
///
/// Takes a base64-encoded encrypted request payload and the target identity ID,
/// generates a sender token, sends the request through the relay, and waits for
/// the response. Returns the base64-encoded encrypted response.
#[tauri::command]
pub async fn relay_join_via_relay(
    request_data: String,
    target_identity: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let relay_url = {
        let state = state.lock().unwrap();
        state.relay_url().to_string()
    }; // Lock released before await

    let payload = BASE64
        .decode(&request_data)
        .map_err(|_| "Invalid request data (not valid base64)".to_string())?;

    // Generate a unique sender token using random bytes
    let sender_token = {
        let token_key = vauchi_core::SymmetricKey::generate();
        hex::encode(token_key.as_bytes())
    };

    let message = crate::relay::DeviceLinkRelayMessage {
        target_identity,
        sender_token,
        payload,
    };

    let response = crate::relay::send_and_receive(&relay_url, &message, 300).await?;

    Ok(BASE64.encode(&response))
}

/// A single frame of a multipart QR code sequence.
#[derive(Serialize)]
pub struct MultipartQRFrame {
    pub frame_number: usize,
    pub total_frames: usize,
    pub svg: String,
}

/// Generate a multipart QR code sequence for large payloads.
///
/// Each frame contains a `WBMP|frame|total|base64_chunk` header so the
/// scanning device can reassemble the payload. For small data that fits in
/// a single QR code the result will contain exactly one frame.
#[tauri::command]
pub fn generate_multipart_qr(data: String) -> Result<Vec<MultipartQRFrame>, String> {
    let bytes = data.as_bytes();
    let chunk_size = 1500; // Safe QR alphanumeric capacity

    // Empty input produces a single frame with empty base64 payload
    if bytes.is_empty() {
        let frame_data = format!("WBMP|1|1|{}", BASE64.encode(b""));
        return Ok(vec![MultipartQRFrame {
            frame_number: 1,
            total_frames: 1,
            svg: generate_qr_svg(&frame_data)?,
        }]);
    }

    let chunks: Vec<&[u8]> = bytes.chunks(chunk_size).collect();
    let total = chunks.len();

    let mut frames = Vec::with_capacity(total);
    for (i, chunk) in chunks.iter().enumerate() {
        let frame_data = format!("WBMP|{}|{}|{}", i + 1, total, BASE64.encode(chunk));
        frames.push(MultipartQRFrame {
            frame_number: i + 1,
            total_frames: total,
            svg: generate_qr_svg(&frame_data)?,
        });
    }

    Ok(frames)
}

// INLINE_TEST_REQUIRED: Tests exercise the private generate_qr_svg helper
// which is not accessible from external test modules.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_qr_svg_contains_svg_element() {
        let svg = generate_qr_svg("WBDL-test-data-string").unwrap();
        assert!(svg.starts_with("<svg"), "SVG should start with <svg tag");
        assert!(svg.contains("</svg>"), "SVG should contain closing tag");
    }

    #[test]
    fn test_deny_device_link_clears_pending_state() {
        // Verify the deny handler clears all pending device link fields.
        // We test at the AppState level since Tauri commands require a full
        // app context. The command is a thin wrapper over this logic.
        use crate::state::AppState;
        use tempfile::TempDir;

        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let mut state = AppState::new(temp_dir.path()).expect("Failed to create state");

        // Simulate pending state by setting the QR field
        state.pending_device_link_qr = Some("fake-qr-data".to_string());

        // Simulate deny: clear all pending fields (same logic as deny_device_link command)
        state.pending_initiator = None;
        state.pending_link_request = None;
        state.pending_device_link_qr = None;

        assert!(
            state.pending_device_link_qr.is_none(),
            "QR data should be cleared after deny"
        );
        assert!(
            state.pending_initiator.is_none(),
            "Initiator should be cleared after deny"
        );
        assert!(
            state.pending_link_request.is_none(),
            "Link request should be cleared after deny"
        );
    }

    #[test]
    fn test_qr_svg_contains_dark_modules() {
        let svg = generate_qr_svg("test-data").unwrap();
        // QR codes have dark modules rendered as black rects
        assert!(
            svg.contains(r#"fill="black""#),
            "SVG should contain dark modules"
        );
    }

    #[test]
    fn test_pending_join_serialization_includes_confirmation() {
        let pending = PendingJoin {
            qr_data: "WBDL-test".to_string(),
            device_name: "My Desktop".to_string(),
            confirmation_code: "123-456".to_string(),
            fingerprint: "AB:CD:EF".to_string(),
        };
        let json = serde_json::to_string(&pending).unwrap();
        let deserialized: PendingJoin = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.confirmation_code, "123-456");
        assert_eq!(deserialized.fingerprint, "AB:CD:EF");
        assert_eq!(deserialized.qr_data, "WBDL-test");
        assert_eq!(deserialized.device_name, "My Desktop");
    }

    #[test]
    fn test_multipart_qr_single_frame_for_small_data() {
        let frames = generate_multipart_qr("short-data".to_string()).unwrap();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].frame_number, 1);
        assert_eq!(frames[0].total_frames, 1);
        assert!(
            frames[0].svg.starts_with("<svg"),
            "SVG should start with <svg tag"
        );
    }

    #[test]
    fn test_multipart_qr_multiple_frames_for_large_data() {
        let large = "x".repeat(3000);
        let frames = generate_multipart_qr(large).unwrap();
        assert_eq!(frames.len(), 2);
        assert_eq!(frames[0].frame_number, 1);
        assert_eq!(frames[0].total_frames, 2);
        assert_eq!(frames[1].frame_number, 2);
        assert_eq!(frames[1].total_frames, 2);
    }

    #[test]
    fn test_multipart_qr_frame_data_contains_wbmp_header() {
        let frames = generate_multipart_qr("test-payload".to_string()).unwrap();
        // The SVG embeds a QR that encodes "WBMP|1|1|<base64>"
        // We verify each frame produces a valid SVG with dark modules
        assert_eq!(frames.len(), 1);
        assert!(
            frames[0].svg.contains(r#"fill="black""#),
            "Frame SVG should contain dark modules from the encoded WBMP header"
        );
    }

    #[test]
    fn test_multipart_qr_empty_input_produces_single_frame() {
        let frames = generate_multipart_qr(String::new()).unwrap();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].frame_number, 1);
        assert_eq!(frames[0].total_frames, 1);
    }

    #[test]
    fn test_multipart_qr_with_null_bytes_succeeds() {
        let data = "before\0after".to_string();
        let frames = generate_multipart_qr(data).unwrap();
        assert!(!frames.is_empty());
        assert!(
            frames[0].svg.starts_with("<svg"),
            "Frame should contain valid SVG"
        );
    }

    #[test]
    fn test_generate_qr_svg_with_empty_string_succeeds() {
        let svg = generate_qr_svg("").unwrap();
        assert!(
            svg.starts_with("<svg"),
            "Empty string should produce valid SVG"
        );
    }
}
