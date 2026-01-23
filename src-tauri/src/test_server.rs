//! Test HTTP Server
//!
//! A simple HTTP server for E2E testing that exposes Tauri commands via REST API.
//! Only enabled when VAUCHI_TEST_PORT environment variable is set.

use std::io::{BufRead, BufReader, Read as IoRead, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;

use crate::state::AppState;

/// Start the test HTTP server on the specified port.
/// Returns the actual port being used.
pub fn start_test_server(state: Arc<Mutex<AppState>>, port: u16) -> std::io::Result<u16> {
    let listener = TcpListener::bind(format!("127.0.0.1:{}", port))?;
    let actual_port = listener.local_addr()?.port();

    println!("Test server listening on port {}", actual_port);

    thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(stream) => {
                    let state = Arc::clone(&state);
                    thread::spawn(move || {
                        if let Err(e) = handle_connection(stream, state) {
                            eprintln!("Test server error: {}", e);
                        }
                    });
                }
                Err(e) => {
                    eprintln!("Test server connection error: {}", e);
                }
            }
        }
    });

    Ok(actual_port)
}

fn handle_connection(mut stream: TcpStream, state: Arc<Mutex<AppState>>) -> std::io::Result<()> {
    let mut buf_reader = BufReader::new(&stream);
    let mut request_line = String::new();
    buf_reader.read_line(&mut request_line)?;

    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 {
        return send_response(&mut stream, 400, "Bad Request");
    }

    let method = parts[0];
    let path = parts[1];

    // Read headers
    let mut content_length = 0usize;
    loop {
        let mut line = String::new();
        buf_reader.read_line(&mut line)?;
        if line == "\r\n" || line == "\n" {
            break;
        }
        if line.to_lowercase().starts_with("content-length:") {
            if let Some(len) = line.split(':').nth(1) {
                content_length = len.trim().parse().unwrap_or(0);
            }
        }
    }

    // Read body for POST requests
    let body = if content_length > 0 {
        let mut body_buf = vec![0u8; content_length];
        buf_reader.read_exact(&mut body_buf)?;
        String::from_utf8_lossy(&body_buf).to_string()
    } else {
        String::new()
    };

    // Route requests
    let (status, response_body) = match (method, path) {
        ("GET", "/health") => (200, r#"{"status":"ok"}"#.to_string()),

        ("GET", "/identity") => {
            let state = state.lock().unwrap();
            if state.has_identity() {
                let info = serde_json::json!({
                    "has_identity": true,
                    "display_name": state.display_name().unwrap_or(""),
                    "public_id": state.public_id().unwrap_or_default()
                });
                (200, info.to_string())
            } else {
                (200, r#"{"has_identity":false}"#.to_string())
            }
        }

        ("POST", "/identity") => {
            let mut state = state.lock().unwrap();
            match serde_json::from_str::<serde_json::Value>(&body) {
                Ok(json) => {
                    let name = json["name"].as_str().unwrap_or("User");
                    match state.create_identity(name) {
                        Ok(_) => {
                            let info = serde_json::json!({
                                "success": true,
                                "display_name": state.display_name().unwrap_or(""),
                                "public_id": state.public_id().unwrap_or_default()
                            });
                            (200, info.to_string())
                        }
                        Err(e) => (500, format!(r#"{{"error":"{}"}}"#, e)),
                    }
                }
                Err(e) => (400, format!(r#"{{"error":"Invalid JSON: {}"}}"#, e)),
            }
        }

        ("GET", "/card") => {
            let state = state.lock().unwrap();
            match state.get_card() {
                Ok(Some(card)) => {
                    let fields: Vec<serde_json::Value> = card
                        .fields()
                        .iter()
                        .map(|f| {
                            serde_json::json!({
                                "type": format!("{:?}", f.field_type()),
                                "label": f.label(),
                                "value": f.value()
                            })
                        })
                        .collect();
                    let info = serde_json::json!({
                        "display_name": card.display_name(),
                        "fields": fields
                    });
                    (200, info.to_string())
                }
                Ok(None) => {
                    let display_name = state.display_name().unwrap_or("User");
                    (200, serde_json::json!({"display_name": display_name, "fields": []}).to_string())
                }
                Err(e) => (500, format!(r#"{{"error":"{}"}}"#, e)),
            }
        }

        ("GET", "/contacts") => {
            let state = state.lock().unwrap();
            match state.list_contacts() {
                Ok(contacts) => {
                    let list: Vec<serde_json::Value> = contacts
                        .iter()
                        .map(|c| {
                            serde_json::json!({
                                "id": c.id,
                                "display_name": c.display_name,
                                "verified": c.verified
                            })
                        })
                        .collect();
                    (200, serde_json::json!({"contacts": list}).to_string())
                }
                Err(e) => (500, format!(r#"{{"error":"{}"}}"#, e)),
            }
        }

        ("POST", "/sync") => {
            let state = state.lock().unwrap();
            match state.sync() {
                Ok(result) => {
                    let info = serde_json::json!({
                        "success": result.success,
                        "contacts_added": result.contacts_added,
                        "cards_updated": result.cards_updated,
                        "updates_sent": result.updates_sent,
                        "error": result.error
                    });
                    (200, info.to_string())
                }
                Err(e) => (500, format!(r#"{{"error":"{}"}}"#, e)),
            }
        }

        _ => (404, r#"{"error":"Not Found"}"#.to_string()),
    };

    send_json_response(&mut stream, status, &response_body)
}

fn send_response(stream: &mut TcpStream, status: u16, message: &str) -> std::io::Result<()> {
    let response = format!(
        "HTTP/1.1 {} {}\r\nContent-Length: 0\r\n\r\n",
        status, message
    );
    stream.write_all(response.as_bytes())
}

fn send_json_response(stream: &mut TcpStream, status: u16, body: &str) -> std::io::Result<()> {
    let status_text = match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        500 => "Internal Server Error",
        _ => "Unknown",
    };
    let response = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
        status,
        status_text,
        body.len(),
        body
    );
    stream.write_all(response.as_bytes())
}
