use std::sync::nonpoison::Mutex;

use bitcode::{Decode, Encode};
use database::{
    DownloadableMetadata, GameDownloadStatus, borrow_db_checked, borrow_db_mut_checked,
    models::data::{InstalledGameType, UserConfiguration}, platform::Platform,
};
use games::{
    collections::collection::Collection,
    downloads::error::LibraryError,
    library::{FetchGameStruct, Game, get_current_meta, uninstall_game_logic},
    state::{GameStatusManager, GameStatusWithTransient},
};
use log::warn;
use process::PROCESS_MANAGER;
use remote::{
    auth::generate_authorization_header,
    cache::{cache_object, cache_object_db, get_cached_object},
    error::{DropServerError, RemoteAccessError},
    offline,
    requests::generate_url,
    utils::DROP_CLIENT_ASYNC,
};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::{AppState, collections::fetch_collections};

#[tauri::command]
pub async fn fetch_library(
    state: tauri::State<'_, Mutex<AppState>>,
    app_handle: AppHandle,
    hard_refresh: Option<bool>,
) -> Result<FetchLibraryResponse, RemoteAccessError> {
    offline!(
        state,
        fetch_library_logic,
        fetch_library_logic_offline,
        state,
        app_handle,
        hard_refresh
    )
    .await
}

#[derive(Encode, Decode, Serialize)]
pub struct FetchLibraryResponse {
    library: Vec<Game>,
    collections: Vec<Collection>,
    other: Vec<Game>,
    missing: Vec<Game>,
}

pub async fn fetch_library_logic(
    state: tauri::State<'_, Mutex<AppState>>,
    app_handle: AppHandle,
    hard_fresh: Option<bool>,
) -> Result<FetchLibraryResponse, RemoteAccessError> {
    let do_hard_refresh = hard_fresh.unwrap_or(false);
    if !do_hard_refresh && let Ok(library) = get_cached_object("library") {
        return Ok(library);
    }

    let response = generate_url(&["/api/v1/client/user/library"], &[])?;
    let auth_header = generate_authorization_header();
    let response = DROP_CLIENT_ASYNC
        .get(response)
        .header("Authorization", auth_header)
        .send()
        .await?;

    if response.status() != 200 {
        let err = response.json().await.unwrap_or(DropServerError {
            status_code: 500,
            status_message: "Server Error".to_owned(),
            message: "Invalid response from server.".to_owned(),
        });
        warn!("{err:?}");
        return Err(RemoteAccessError::InvalidResponse(err));
    }

    let library: Vec<Game> = response.json().await?;
    let collections = fetch_collections(state, hard_fresh).await?;

    let mut all_games = library.clone();
    all_games.extend(
        collections
            .iter()
            .flat_map(|v| v.entries.iter().map(|v| v.game.clone())),
    );

    let installed_metas = {
        let mut db_handle = borrow_db_mut_checked();

        for game in &all_games {
            if !db_handle.applications.game_statuses.contains_key(game.id()) {
                db_handle
                    .applications
                    .game_statuses
                    .insert(game.id().clone(), GameDownloadStatus::Remote {});
            }
            cache_object_db(&format!("game/{}", game.id), game, &db_handle)?;
        }

        db_handle
            .applications
            .installed_game_version
            .values()
            .cloned()
            .collect::<Vec<DownloadableMetadata>>()
    };

    // Add games that are installed but no longer in library
    let mut other = Vec::new();
    let mut missing = Vec::new();
    for meta in installed_metas {
        if all_games.iter().any(|e| *e.id() == meta.id) {
            continue;
        }
        // We should always have a cache of the object
        // Pass db_handle because otherwise we get a gridlock
        let game = match get_cached_object::<Game>(&meta.id.clone()) {
            Ok(game) => game,
            Err(err) => {
                warn!(
                    "{} is installed, but encountered error fetching its error: {}.",
                    meta.id, err
                );
                /*
                 * We can't return a dummy object here because it needs to be in the cache to work
                 * So we uninstall the game so we don't "lose" it
                 */
                uninstall_game_logic(meta.clone(), &app_handle);
                continue;
            }
        };
        if game.game_type == "Game" {
            missing.push(game);
        } else {
            other.push(game);
        }
    }

    let response = FetchLibraryResponse {
        library,
        collections,
        other,
        missing,
    };

    cache_object("library", &response)?;

    Ok(response)
}
pub async fn fetch_library_logic_offline(
    _state: tauri::State<'_, Mutex<AppState>>,
    _app_handle: AppHandle,
    _hard_refresh: Option<bool>,
) -> Result<FetchLibraryResponse, RemoteAccessError> {
    let mut response: FetchLibraryResponse = get_cached_object("library")?;

    let db_handle = borrow_db_checked();

    let retain_filter = |game: &Game| {
        matches!(
            &db_handle
                .applications
                .game_statuses
                .get(game.id())
                .unwrap_or(&GameDownloadStatus::Remote {}),
            GameDownloadStatus::Installed {
                install_type: InstalledGameType::Installed | InstalledGameType::SetupRequired,
                ..
            }
        )
    };

    response.library.retain(retain_filter);
    response.other.retain(retain_filter);
    response.missing.retain(retain_filter);
    response
        .collections
        .iter_mut()
        .for_each(|k| k.entries.retain(|object| retain_filter(&object.game)));

    Ok(response)
}
pub async fn fetch_game_logic(
    id: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<FetchGameStruct, RemoteAccessError> {
    let version = {
        let db_lock = borrow_db_checked();

        let metadata_option = db_lock.applications.installed_game_version.get(&id);

        match metadata_option {
            None => None,
            Some(metadata) => db_lock
                .applications
                .game_versions
                .get(&metadata.version)
                .cloned(),
        }
    };

    let game = match get_cached_object::<Game>(&format!("game/{}", id)) {
        Ok(value) => value,
        Err(_) => {
            let client = DROP_CLIENT_ASYNC.clone();
            let response = generate_url(&["/api/v1/client/game", &id], &[])?;
            let response = client
                .get(response)
                .header("Authorization", generate_authorization_header())
                .send()
                .await?;

            if response.status() == 404 {
                let offline_fetch = fetch_game_logic_offline(id.clone(), state).await;
                if let Ok(fetch_data) = offline_fetch {
                    return Ok(fetch_data);
                }

                return Err(RemoteAccessError::GameNotFound(id));
            }
            if response.status() != 200 {
                let err = response.json().await?;
                warn!("{err:?}");
                return Err(RemoteAccessError::InvalidResponse(err));
            }

            let game: Game = response.json().await?;
            game
        }
    };

    let mut db_handle = borrow_db_mut_checked();

    db_handle
        .applications
        .game_statuses
        .entry(id.clone())
        .or_insert(GameDownloadStatus::Remote {});

    let status = GameStatusManager::fetch_state(&id, &db_handle);

    drop(db_handle);

    let data = FetchGameStruct::new(game.clone(), status, version);

    cache_object(&format!("game/{}", id), &game)?;

    Ok(data)
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VersionDownloadOptionRequiredContent {
    game_id: String,
    version_id: String,
    name: String,
    icon_object_id: String,
    short_description: String,
    size: GameSize,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionDownloadOption {
    pub game_id: String,
    pub version_id: String,
    display_name: Option<String>,
    version_path: String,
    pub platform: Platform,
    size: GameSize,
    required_content: Vec<VersionDownloadOptionRequiredContent>,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSize {
    install_size: usize,
    download_size: usize,
}

pub async fn fetch_game_version_options_logic(
    game_id: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<Vec<VersionDownloadOption>, RemoteAccessError> {
    let client = DROP_CLIENT_ASYNC.clone();

    let previous_id = borrow_db_checked()
        .applications
        .installed_game_version
        .get(&game_id)
        .map(|v| v.version.clone());

    let response = generate_url(
        &["/api/v1/client/game", &game_id, "versions"],
        &[("previous", &previous_id.unwrap_or(String::new()))],
    )?;
    let response = client
        .get(response)
        .header("Authorization", generate_authorization_header())
        .send()
        .await?;

    if response.status() != 200 {
        let err = response.json().await?;
        warn!("{err:?}");
        return Err(RemoteAccessError::InvalidResponse(err));
    }

    let data: Vec<VersionDownloadOption> = response.json().await?;

    let state_lock = state.lock();
    let process_manager_lock = PROCESS_MANAGER.lock();
    let data: Vec<VersionDownloadOption> = data
        .into_iter()
        .filter(|v| process_manager_lock.valid_platform(&v.platform))
        .collect();
    //data.dedup_by_key(|v| v.platform);
    drop(process_manager_lock);
    drop(state_lock);

    Ok(data)
}

pub async fn fetch_game_logic_offline(
    id: String,
    _state: tauri::State<'_, Mutex<AppState>>,
) -> Result<FetchGameStruct, RemoteAccessError> {
    let db_handle = borrow_db_checked();
    let metadata_option = db_handle.applications.installed_game_version.get(&id);
    let version = match metadata_option {
        None => None,
        Some(metadata) => db_handle
            .applications
            .game_versions
            .get(&metadata.version)
            .cloned(),
    };

    let status = GameStatusManager::fetch_state(&id, &db_handle);
    let game = get_cached_object::<Game>(&format!("game/{}", id))?;

    drop(db_handle);

    Ok(FetchGameStruct::new(game, status, version))
}

#[tauri::command]
pub async fn fetch_game(
    game_id: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<FetchGameStruct, RemoteAccessError> {
    offline!(
        state,
        fetch_game_logic,
        fetch_game_logic_offline,
        game_id,
        state
    )
    .await
}

#[tauri::command]
pub fn fetch_game_status(id: String) -> GameStatusWithTransient {
    let db_handle = borrow_db_checked();
    GameStatusManager::fetch_state(&id, &db_handle)
}

#[tauri::command]
pub fn uninstall_game(game_id: String, app_handle: AppHandle) -> Result<(), LibraryError> {
    let meta = match get_current_meta(&game_id) {
        Some(data) => data,
        None => return Err(LibraryError::MetaNotFound(game_id)),
    };
    uninstall_game_logic(meta, &app_handle);

    Ok(())
}

#[tauri::command]
pub async fn fetch_game_version_options(
    game_id: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<Vec<VersionDownloadOption>, RemoteAccessError> {
    fetch_game_version_options_logic(game_id, state).await
}

#[tauri::command]
pub fn update_game_configuration(
    game_id: String,
    options: UserConfiguration,
) -> Result<(), LibraryError> {
    let mut handle = borrow_db_mut_checked();
    let installed_version = handle
        .applications
        .installed_game_version
        .get(&game_id)
        .ok_or(LibraryError::MetaNotFound(game_id))?;

    let _id = installed_version.id.clone();
    let version = installed_version.version.clone();

    let mut existing_configuration = handle
        .applications
        .game_versions
        .get(&version)
        .unwrap()
        .clone();

    existing_configuration.user_configuration = options;

    handle
        .applications
        .game_versions
        .insert(version.to_string(), existing_configuration);

    Ok(())
}
