// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Device link relay transport for desktop.
//!
//! Adapted from vauchi-mobile/src/device_link_relay.rs for desktop use.
//! The desktop version uses `tokio-tungstenite::connect_async` directly
//! (no cert pinning module needed).

use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::Message;

/// A device link message sent through the relay.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DeviceLinkRelayMessage {
    /// Identity public key (hex) of the target device.
    pub target_identity: String,
    /// Unique sender token for routing the response back.
    pub sender_token: String,
    /// Encrypted payload bytes (device link request or response).
    pub payload: Vec<u8>,
}

/// Serialize a `DeviceLinkRelayMessage` to JSON bytes.
pub fn encode_device_link_message(msg: &DeviceLinkRelayMessage) -> Vec<u8> {
    serde_json::to_vec(msg).expect("DeviceLinkRelayMessage serialization should not fail")
}

/// Deserialize a `DeviceLinkRelayMessage` from JSON bytes.
pub fn decode_device_link_message(data: &[u8]) -> Result<DeviceLinkRelayMessage, String> {
    serde_json::from_slice(data)
        .map_err(|e| format!("Failed to decode DeviceLinkRelayMessage: {e}"))
}

/// Listen for an incoming device link request via relay (initiator/existing device).
///
/// Sends a "listening" handshake so the relay knows who we are, then waits for
/// an incoming binary message from a new device.
///
/// Returns `(payload, sender_token)` on success.
pub async fn listen_for_request(
    relay_url: &str,
    identity_id: &str,
    timeout_secs: u64,
) -> Result<(Vec<u8>, String), String> {
    let (mut socket, _) = tokio_tungstenite::connect_async(relay_url)
        .await
        .map_err(|e| format!("WebSocket connection failed: {e}"))?;

    // Send listening handshake so the relay knows who we are
    let handshake = serde_json::json!({
        "type": "device_link_listen",
        "identity_id": identity_id,
    });
    let handshake_bytes =
        serde_json::to_vec(&handshake).map_err(|e| format!("Failed to encode handshake: {e}"))?;
    socket
        .send(Message::Binary(handshake_bytes))
        .await
        .map_err(|e| format!("Failed to send listening handshake: {e}"))?;

    // Wait for incoming request
    let result = tokio::time::timeout(Duration::from_secs(timeout_secs), async {
        while let Some(msg) = socket.next().await {
            match msg {
                Ok(Message::Binary(data)) => {
                    let relay_msg = decode_device_link_message(&data)?;
                    return Ok((relay_msg.payload, relay_msg.sender_token));
                }
                Ok(Message::Close(_)) => {
                    return Err("Relay closed connection while listening".to_string())
                }
                Ok(_) => continue,
                Err(e) => return Err(format!("WebSocket error while listening: {e}")),
            }
        }
        Err("Connection closed while listening".to_string())
    })
    .await
    .map_err(|_| "Timed out waiting for device link request".to_string())??;

    let _ = socket.close(None).await;
    Ok(result)
}

/// Send a device link response back via relay (initiator/existing device).
///
/// Routes the encrypted response back to the new device using the sender token.
pub async fn send_response(
    relay_url: &str,
    sender_token: &str,
    response_payload: Vec<u8>,
) -> Result<(), String> {
    let (mut socket, _) = tokio_tungstenite::connect_async(relay_url)
        .await
        .map_err(|e| format!("WebSocket connection failed: {e}"))?;

    let msg = DeviceLinkRelayMessage {
        target_identity: String::new(), // Response is routed by sender_token
        sender_token: sender_token.to_string(),
        payload: response_payload,
    };

    let data = encode_device_link_message(&msg);
    socket
        .send(Message::Binary(data))
        .await
        .map_err(|e| format!("Failed to send device link response: {e}"))?;

    let _ = socket.close(None).await;
    Ok(())
}

/// Send a device link request and wait for a response via relay (responder/new device).
///
/// Used by the new device to send an encrypted request and receive the existing
/// device's encrypted response in a single roundtrip.
pub async fn send_and_receive(
    relay_url: &str,
    message: &DeviceLinkRelayMessage,
    timeout_secs: u64,
) -> Result<Vec<u8>, String> {
    let (mut socket, _) = tokio_tungstenite::connect_async(relay_url)
        .await
        .map_err(|e| format!("WebSocket connection failed: {e}"))?;

    let data = encode_device_link_message(message);
    socket
        .send(Message::Binary(data))
        .await
        .map_err(|e| format!("Failed to send device link message: {e}"))?;

    // Wait for binary response
    let response = tokio::time::timeout(Duration::from_secs(timeout_secs), async {
        while let Some(msg) = socket.next().await {
            match msg {
                Ok(Message::Binary(data)) => return Ok(data),
                Ok(Message::Close(_)) => {
                    return Err("Relay closed connection before response".to_string())
                }
                Ok(_) => continue, // skip text/ping/pong
                Err(e) => return Err(format!("WebSocket error: {e}")),
            }
        }
        Err("Connection closed without response".to_string())
    })
    .await
    .map_err(|_| "Timed out waiting for device link response".to_string())??;

    let _ = socket.close(None).await;
    Ok(response)
}

// INLINE_TEST_REQUIRED: Tests verify internal encode/decode functions not exposed via public API
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_relay_message_encode_decode_roundtrip() {
        let msg = DeviceLinkRelayMessage {
            target_identity: "abc123".to_string(),
            sender_token: "tok-001".to_string(),
            payload: vec![0x01, 0x02, 0xFF],
        };
        let encoded = encode_device_link_message(&msg);
        let decoded =
            decode_device_link_message(&encoded).expect("roundtrip decode should succeed");
        assert_eq!(decoded.target_identity, "abc123");
        assert_eq!(decoded.sender_token, "tok-001");
        assert_eq!(decoded.payload, vec![0x01, 0x02, 0xFF]);
    }

    #[test]
    fn test_relay_message_with_empty_payload() {
        let msg = DeviceLinkRelayMessage {
            target_identity: "identity-key".to_string(),
            sender_token: "token-empty".to_string(),
            payload: vec![],
        };
        let encoded = encode_device_link_message(&msg);
        let decoded =
            decode_device_link_message(&encoded).expect("empty payload roundtrip should succeed");
        assert_eq!(decoded.target_identity, "identity-key");
        assert_eq!(decoded.sender_token, "token-empty");
        assert!(decoded.payload.is_empty(), "payload should be empty");
    }

    #[test]
    fn test_relay_message_decode_invalid_json() {
        let result = decode_device_link_message(b"not valid json");
        assert!(result.is_err(), "decoding invalid JSON should fail");

        let err_msg = result.unwrap_err();
        assert!(
            err_msg.contains("Failed to decode"),
            "error should contain 'Failed to decode', got: {err_msg}"
        );
    }

    #[test]
    fn test_relay_message_with_large_payload() {
        let large_payload = vec![0xAB; 65536];
        let msg = DeviceLinkRelayMessage {
            target_identity: "large-test".to_string(),
            sender_token: "tok-large".to_string(),
            payload: large_payload.clone(),
        };
        let encoded = encode_device_link_message(&msg);
        let decoded =
            decode_device_link_message(&encoded).expect("large payload roundtrip should succeed");
        assert_eq!(decoded.payload.len(), 65536);
        assert_eq!(decoded.payload, large_payload);
    }

    #[test]
    fn test_relay_message_with_unicode_fields() {
        let msg = DeviceLinkRelayMessage {
            target_identity: "identite-\u{00E9}\u{00E8}\u{00EA}".to_string(),
            sender_token: "\u{1F512}secure-token".to_string(),
            payload: vec![42],
        };
        let encoded = encode_device_link_message(&msg);
        let decoded =
            decode_device_link_message(&encoded).expect("unicode field roundtrip should succeed");
        assert_eq!(decoded.target_identity, "identite-\u{00E9}\u{00E8}\u{00EA}");
        assert_eq!(decoded.sender_token, "\u{1F512}secure-token");
        assert_eq!(decoded.payload, vec![42]);
    }

    #[test]
    fn test_relay_message_decode_missing_field() {
        // JSON with a missing required field (no sender_token)
        let partial_json = br#"{"target_identity":"abc","payload":[1]}"#;
        let result = decode_device_link_message(partial_json);
        assert!(
            result.is_err(),
            "decoding JSON with missing fields should fail"
        );
    }

    #[test]
    fn test_relay_message_decode_empty_bytes() {
        let result = decode_device_link_message(b"");
        assert!(result.is_err(), "decoding empty bytes should fail");
    }
}
