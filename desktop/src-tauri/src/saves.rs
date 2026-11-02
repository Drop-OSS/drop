//! Cloud-saves Tauri commands.
//!
//! The automatic flows run inside the launch/exit paths themselves (see
//! `process::process_manager` and `launch_game`); what lives here is the
//! manual surface the UI drives: the save timeline, restore, pin, "Sync
//! now", and the always-ask conflict answers. Every flow that changes
//! sync state emits the same `saves_state` event so any open view updates
//! from one listener.

use cloud_saves::client::{SaveClient, SaveVersion};
use cloud_saves::engine::{
    AUTO_SLOT, ConflictChoice, SaveStateEvent, SaveSyncOutcome, build_plan, resolve_conflict,
    restore_to_version, sync_at,
};
use tauri::{AppHandle, Emitter as _};

/// Manually sync one game's saves (same pull-or-back-up logic as the
/// launch/exit flows, tagged `manual`). `None` when the game has no curated
/// save manifest or is not installed here - saves are simply not managed.
#[tauri::command]
pub async fn sync_game_saves(app_handle: AppHandle, game_id: String) -> Option<SaveSyncOutcome> {
    let plan = build_plan(&game_id, AUTO_SLOT)?;
    let outcome = sync_at(&plan, "manual").await;
    emit_state(&app_handle, &game_id, &outcome);
    Some(outcome)
}

/// The version timeline for a game's auto slot, newest first; pass the last
/// row's `id` back as `cursor` for the next page. An empty list means no
/// backup has ever been stored (it is not an error).
#[tauri::command]
pub async fn fetch_save_timeline(
    game_id: String,
    cursor: Option<String>,
) -> Result<Vec<SaveVersion>, String> {
    let client = SaveClient::from_desktop().map_err(|e| e.to_string())?;
    client
        .list_versions(&game_id, AUTO_SLOT, cursor.as_deref(), Some(50))
        .await
        .map_err(|e| e.to_string())
}

/// Publish a stored version as the new head (the server appends a fresh
/// `Restore` version - history is never rewritten) and write it to disk.
#[tauri::command]
pub async fn restore_save_version(
    app_handle: AppHandle,
    game_id: String,
    version_id: String,
) -> Option<SaveSyncOutcome> {
    let plan = build_plan(&game_id, AUTO_SLOT)?;
    let outcome = match restore_to_version(&plan, &version_id).await {
        Ok(outcome) => outcome,
        Err(error) => SaveSyncOutcome::Failed {
            stage: "restore".to_string(),
            error: error.to_string(),
        },
    };
    emit_state(&app_handle, &game_id, &outcome);
    Some(outcome)
}

/// Protect (or unprotect) a version from retention pruning.
#[tauri::command]
pub async fn set_save_version_pinned(
    game_id: String,
    version_id: String,
    pinned: bool,
) -> Result<SaveVersion, String> {
    SaveClient::from_desktop()
        .map_err(|e| e.to_string())?
        .set_pinned(&game_id, AUTO_SLOT, &version_id, pinned)
        .await
        .map_err(|e| e.to_string())
}

/// The conflict answer, taken from the dialog: keep this device's save,
/// take the server's, or keep both (server head pinned, local pushed on
/// top). Never invoked without an explicit user choice.
#[tauri::command]
pub async fn resolve_save_conflict(
    app_handle: AppHandle,
    game_id: String,
    choice: ConflictChoice,
) -> Option<SaveSyncOutcome> {
    let plan = build_plan(&game_id, AUTO_SLOT)?;
    let outcome = match resolve_conflict(&plan, choice).await {
        Ok(outcome) => outcome,
        Err(error) => SaveSyncOutcome::Failed {
            stage: "conflict".to_string(),
            error: error.to_string(),
        },
    };
    emit_state(&app_handle, &game_id, &outcome);
    Some(outcome)
}

fn emit_state(app_handle: &AppHandle, game_id: &str, outcome: &SaveSyncOutcome) {
    let _ = app_handle.emit(
        "saves_state",
        SaveStateEvent {
            game_id: game_id.to_string(),
            slot: AUTO_SLOT,
            outcome: outcome.clone(),
        },
    );
}
