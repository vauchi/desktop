// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

//! Workflow Commands
//!
//! Tauri IPC commands for core-driven workflows (onboarding, etc.).
//! Bridges the core WorkflowEngine to the SolidJS frontend via JSON.

use std::sync::Mutex;

use tauri::State;
use vauchi_core::ui::{ActionResult, OnboardingEngine, UserAction, WorkflowEngine};

use crate::error::CommandError;

/// Holds the active onboarding workflow engine.
pub struct OnboardingState {
    pub engine: Option<OnboardingEngine>,
}

/// Start a new onboarding workflow and return the first screen as JSON.
#[tauri::command]
pub fn start_onboarding(
    onboarding: State<'_, Mutex<OnboardingState>>,
) -> Result<String, CommandError> {
    let mut state = onboarding
        .lock()
        .map_err(|e| CommandError::Storage(format!("Mutex poisoned: {e}")))?;
    let engine = OnboardingEngine::new();
    let screen = engine.current_screen();
    state.engine = Some(engine);

    serde_json::to_string(&screen).map_err(CommandError::from)
}

/// Get the current onboarding screen as JSON.
#[tauri::command]
pub fn get_onboarding_screen(
    onboarding: State<'_, Mutex<OnboardingState>>,
) -> Result<String, CommandError> {
    let state = onboarding
        .lock()
        .map_err(|e| CommandError::Storage(format!("Mutex poisoned: {e}")))?;
    let engine = state
        .engine
        .as_ref()
        .ok_or_else(|| CommandError::Identity("No onboarding in progress".to_string()))?;

    let screen = engine.current_screen();
    serde_json::to_string(&screen).map_err(CommandError::from)
}

/// Handle an onboarding user action and return the result as JSON.
#[tauri::command]
pub fn handle_onboarding_action(
    action_json: String,
    onboarding: State<'_, Mutex<OnboardingState>>,
) -> Result<String, CommandError> {
    let action: UserAction =
        serde_json::from_str(&action_json).map_err(|e| CommandError::Validation(e.to_string()))?;

    let mut state = onboarding
        .lock()
        .map_err(|e| CommandError::Storage(format!("Mutex poisoned: {e}")))?;
    let engine = state
        .engine
        .as_mut()
        .ok_or_else(|| CommandError::Identity("No onboarding in progress".to_string()))?;

    let result = engine.handle_action(action);

    // If complete, extract the data before serializing the result
    if matches!(result, ActionResult::Complete) {
        // Engine data is available via engine.data() — caller should
        // use get_onboarding_data to retrieve it before clearing.
    }

    serde_json::to_string(&result).map_err(CommandError::from)
}

/// Get the collected onboarding data as JSON.
///
/// Called after ActionResult::Complete to retrieve the final data
/// for persisting to storage.
#[tauri::command]
pub fn get_onboarding_data(
    onboarding: State<'_, Mutex<OnboardingState>>,
) -> Result<String, CommandError> {
    let state = onboarding
        .lock()
        .map_err(|e| CommandError::Storage(format!("Mutex poisoned: {e}")))?;
    let engine = state
        .engine
        .as_ref()
        .ok_or_else(|| CommandError::Identity("No onboarding in progress".to_string()))?;

    serde_json::to_string(engine.data()).map_err(CommandError::from)
}
