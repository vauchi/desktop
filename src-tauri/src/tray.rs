// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! System tray icon setup and event handling.

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

/// Set up the system tray icon with context menu.
///
/// Creates a tray icon with a "Show Vauchi" / "Quit" context menu.
/// Left-click toggles window visibility, right-click opens the menu.
pub fn setup(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Show Vauchi", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    let icon = Image::from_bytes(include_bytes!("../icons/tray-icon.png"))?;

    TrayIconBuilder::new()
        .icon(icon)
        .icon_as_template(true) // macOS: auto dark/light mode adaptation
        .tooltip("Vauchi")
        .menu(&menu)
        .show_menu_on_left_click(false) // left click toggles window, right click opens menu
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => toggle_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn toggle_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
