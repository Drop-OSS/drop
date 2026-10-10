use std::fs;
use std::path::PathBuf;

use database::borrow_db_checked;

use crate::path_guard;

pub(crate) fn get_game_install_dir(game_id: &str) -> Result<PathBuf, String> {
    let db = borrow_db_checked();
    if let Some(database::GameDownloadStatus::Installed { install_dir, .. }) =
        db.applications.game_statuses.get(game_id)
    {
        let path = PathBuf::from(install_dir);
        if path.exists() {
            return Ok(path);
        }
        return Err(format!(
            "Game install directory does not exist: {}",
            path.display()
        ));
    }
    Err(format!(
        "Game with id '{game_id}' is not installed or not found in local database"
    ))
}

#[tauri::command]
pub async fn plugin_game_fs_read(
    game_id: String,
    relative_path: String,
) -> Result<Vec<u8>, String> {
    let install_dir = get_game_install_dir(&game_id)?;
    let safe_path = path_guard::safe_join(&install_dir, &relative_path)
        .map_err(|e| format!("Security check failed: {e}"))?;

    fs::read(&safe_path).map_err(|e| format!("Failed to read {relative_path}: {e}"))
}

#[tauri::command]
pub async fn plugin_game_fs_write(
    game_id: String,
    relative_path: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let install_dir = get_game_install_dir(&game_id)?;
    path_guard::write_file(&install_dir, &relative_path, &data)
        .map_err(|e| format!("Failed to write {relative_path}: {e}"))
}

#[tauri::command]
pub async fn plugin_game_fs_backup(
    game_id: String,
    relative_path: String,
) -> Result<String, String> {
    let install_dir = get_game_install_dir(&game_id)?;
    let src_path = path_guard::safe_join(&install_dir, &relative_path)
        .map_err(|e| format!("Security check failed: {e}"))?;

    if !src_path.exists() {
        return Err(format!(
            "Cannot backup nonexistent file: {}",
            src_path.display()
        ));
    }

    let backup_relative = format!("{}.drop-backup", relative_path);
    path_guard::copy_to(&install_dir, &src_path, &backup_relative)
        .map_err(|e| format!("Failed to create backup {backup_relative}: {e}"))?;

    Ok(backup_relative)
}

#[tauri::command]
pub async fn plugin_game_fs_restore(game_id: String, relative_path: String) -> Result<(), String> {
    let install_dir = get_game_install_dir(&game_id)?;
    let backup_relative = format!("{}.drop-backup", relative_path);
    let backup_path = path_guard::safe_join(&install_dir, &backup_relative)
        .map_err(|e| format!("Security check failed: {e}"))?;

    if !backup_path.exists() {
        return Err(format!(
            "Cannot restore missing backup file: {backup_relative}"
        ));
    }

    path_guard::copy_to(&install_dir, &backup_path, &relative_path)
        .map_err(|e| format!("Failed to restore file from backup: {e}"))?;

    // Cleanup backup file
    let _ = path_guard::remove_file(&install_dir, &backup_relative);

    Ok(())
}

#[tauri::command]
pub async fn plugin_game_fs_exists(game_id: String, relative_path: String) -> Result<bool, String> {
    let install_dir = get_game_install_dir(&game_id)?;
    match path_guard::safe_join(&install_dir, &relative_path) {
        Ok(safe_path) => Ok(safe_path.exists()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn plugin_game_fs_delete(game_id: String, relative_path: String) -> Result<(), String> {
    let install_dir = get_game_install_dir(&game_id)?;
    path_guard::remove_file(&install_dir, &relative_path)
        .map_err(|e| format!("Failed to delete {relative_path}: {e}"))
}
