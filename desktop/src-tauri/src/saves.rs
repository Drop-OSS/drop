//! Cloud-saves Tauri commands.
//!
//! The automatic flows run inside the launch/exit paths themselves (see
//! `process::process_manager` and `launch_game`); what lives here is the
//! manual entry point - the "Sync now" action, and the hook step 4's save
//! timeline UI will call. Every flow, automatic or manual, emits the same
//! `saves_state` event so any open view updates from one listener.

use cloud_saves::engine::{AUTO_SLOT, SaveStateEvent, SaveSyncOutcome, build_plan, sync_at};
use tauri::{AppHandle, Emitter as _};

/// Manually sync one game's saves (same pull-or-back-up logic as the
/// launch/exit flows, tagged `manual`). `None` when the game has no curated
/// save manifest or is not installed here - saves are simply not managed.
#[tauri::command]
pub async fn sync_game_saves(app_handle: AppHandle, game_id: String) -> Option<SaveSyncOutcome> {
    let plan = build_plan(&game_id, AUTO_SLOT)?;
    let outcome = sync_at(&plan, "manual").await;
    let _ = app_handle.emit(
        "saves_state",
        SaveStateEvent {
            game_id,
            slot: AUTO_SLOT,
            outcome: outcome.clone(),
        },
    );
    Some(outcome)
}
