//! Profile Tauri commands: the account's players, and which one this device
//! plays as.
//!
//! The active choice is local (it lives in the desktop database); every
//! authenticated request the app makes afterwards - playtime reports, library
//! fetches, save syncs - carries it, so stats and saves land on the right
//! player. Choosing "default" (`None`) hands the decision back to the server,
//! which is exactly how a pre-profile install behaved.

use database::interface::borrow_db_mut_checked;
use remote::profiles::ProfileDto;

/// The account's players, default first.
#[tauri::command]
pub async fn fetch_profiles() -> Result<Vec<ProfileDto>, String> {
    remote::profiles::fetch_profiles()
        .await
        .map_err(|e| e.to_string())
}

/// Add a player to the account.
#[tauri::command]
pub async fn create_profile(name: String) -> Result<ProfileDto, String> {
    remote::profiles::create_profile(&name)
        .await
        .map_err(|e| e.to_string())
}

/// Rename a player; their stats and saves ride through unchanged.
#[tauri::command]
pub async fn rename_profile(id: String, name: String) -> Result<ProfileDto, String> {
    remote::profiles::rename_profile(&id, &name)
        .await
        .map_err(|e| e.to_string())
}

/// Give a player a new colour (their avatar is regenerated server-side).
#[tauri::command]
pub async fn set_profile_color(id: String, color: String) -> Result<ProfileDto, String> {
    remote::profiles::set_profile_color(&id, &color)
        .await
        .map_err(|e| e.to_string())
}

/// Which player this device acts as. `None` = the account's default profile.
/// Returns the new choice so the caller can stay in sync without a re-fetch.
/// The write persists when the guard drops.
#[tauri::command]
pub fn set_current_profile(profile_id: Option<String>) -> Option<String> {
    let new_choice = {
        let mut db = borrow_db_mut_checked();
        db.current_profile_id = profile_id.clone();
        profile_id // the write persists as this guard drops
    };
    // Library rows embed the viewing profile's playtime, so a cached library
    // from the previous player must not survive the switch.
    let _ = remote::cache::clear_cached_object("library");
    new_choice
}

/// The current choice (`None` = default profile).
#[tauri::command]
pub fn get_current_profile() -> Option<String> {
    database::DB.fetch_current_profile_id()
}
