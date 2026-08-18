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
    FlagActionRequired { launch_id: String, flag: String },
}

#[tauri::command]
pub fn launch_game(id: String, index: usize) -> Result<LaunchResult, ProcessError> {
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

    if let Err(err) = &result
        && let ProcessError::FlagActionRequired { launch_id, flag } = err
    {
        return Ok(LaunchResult::FlagActionRequired {
            launch_id: launch_id.to_string(),
            flag: flag.to_string(),
        });
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

#[tauri::command]
pub fn acknowledge_flag(
    launch_id: String,
    flag: String,
    auto_handled: bool,
) -> Result<(), ProcessError> {
    use database::borrow_db_mut_checked;
    use database::FlagAcknowledgment;

    let mut db = borrow_db_mut_checked();
    let acknowledgment = if auto_handled {
        FlagAcknowledgment::AutoHandled
    } else {
        FlagAcknowledgment::ManuallyHandled
    };
    db.applications
        .flag_acknowledgments
        .insert((launch_id, flag), acknowledgment);
    Ok(())
}

#[tauri::command]
pub fn get_flag_status(launch_id: String, flag: String) -> Result<Option<String>, ProcessError> {
    use database::borrow_db_checked;
    use database::FlagAcknowledgment;

    let db = borrow_db_checked();
    let acknowledgment = db
        .applications
        .flag_acknowledgments
        .get(&(launch_id, flag));

    Ok(match acknowledgment {
        Some(FlagAcknowledgment::NotAcknowledged) | None => None,
        Some(FlagAcknowledgment::AutoHandled) => Some("auto_handled".to_string()),
        Some(FlagAcknowledgment::ManuallyHandled) => Some("manually_handled".to_string()),
    })
}
