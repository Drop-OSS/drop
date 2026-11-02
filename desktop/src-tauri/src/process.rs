use std::sync::Arc;

use process::{
    PROCESS_MANAGER,
    error::ProcessError,
    process_manager::{LaunchOption, ProcessHandlerOption, ProcessManager},
};
use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub fn get_launch_options(id: String) -> Result<Vec<LaunchOption>, ProcessError> {
    let launch_options = ProcessManager::get_launch_options(id)?;

    Ok(launch_options)
}

#[tauri::command]
pub fn get_process_handlers(id: String) -> Result<Vec<ProcessHandlerOption>, ProcessError> {
    PROCESS_MANAGER.lock().get_process_handlers(id)
}

#[derive(Serialize)]
#[serde(tag = "result", content = "data")]
pub enum LaunchResult {
    Success,
    InstallRequired(String, String),
}

#[tauri::command]
pub async fn launch_game(
    app_handle: AppHandle,
    id: String,
    index: usize,
) -> Result<LaunchResult, ProcessError> {
    use tauri::Emitter as _;

    // Cloud saves first: a newer server copy must be on disk before the game
    // opens its saves. Never blocks playing - the engine turns every network
    // or manifest problem into a `Failed`/`Conflict` outcome instead of an
    // error, and games without a curated manifest get `None` instantly. The
    // database lock inside `build_plan` is taken and released before this
    // await chain, and PROCESS_MANAGER is only locked after it completes.
    if let Some(outcome) = cloud_saves::engine::pre_launch(&id).await {
        let _ = app_handle.emit(
            "saves_state",
            cloud_saves::engine::SaveStateEvent {
                game_id: id.clone(),
                slot: cloud_saves::engine::AUTO_SLOT,
                outcome,
            },
        );
    }

    let result = {
        let mut process_manager_lock = PROCESS_MANAGER.lock();

        process_manager_lock.launch_process(id, index)
    };

    if let Err(err) = &result
        && let ProcessError::RequiredDependency(game_id, version_id) = err
    {
        return Ok(LaunchResult::InstallRequired(
            game_id.to_string(),
            version_id.to_string(),
        ));
    }

    result?;

    Ok(LaunchResult::Success)
}

#[tauri::command]
pub fn kill_game(game_id: String) -> Result<(), ProcessError> {
    Ok(PROCESS_MANAGER.lock().kill_game(game_id)?)
}

#[tauri::command]
pub fn open_process_logs(game_id: String, app_handle: AppHandle) -> Result<(), ProcessError> {
    let process_manager_lock = PROCESS_MANAGER.lock();

    let dir = process_manager_lock.get_log_dir(game_id);
    app_handle
        .opener()
        .open_path(dir.display().to_string(), None::<&str>)
        .map_err(|v| ProcessError::OpenerError(Arc::new(v)))
}
