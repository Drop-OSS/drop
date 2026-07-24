use std::sync::nonpoison::Mutex;

use client::app_state::AppState;
use database::{GameDownloadStatus, borrow_db_checked, models::data::InstalledGameType};
use games::collections::collection::Collections;
use remote::{
    cache::{cache_object, get_cached_object},
    error::RemoteAccessError,
    offline,
    requests::{generate_url, make_authenticated_get},
};

pub async fn fetch_collections(
    state: tauri::State<'_, Mutex<AppState>>,
    hard_refresh: Option<bool>,
) -> Result<Collections, RemoteAccessError> {
    offline!(
        state,
        fetch_collections_online,
        fetch_collections_offline,
        hard_refresh
    )
    .await
}

pub async fn fetch_collections_online(
    hard_refresh: Option<bool>,
) -> Result<Collections, RemoteAccessError> {
    let do_hard_refresh = hard_refresh.unwrap_or(false);
    if !do_hard_refresh && let Ok(cached_response) = get_cached_object::<Collections>("collections")
    {
        return Ok(cached_response);
    }

    let response =
        make_authenticated_get(generate_url(&["/api/v1/client/collection"], &[])?).await?;

    let collections: Collections = response.json().await?;

    cache_object("collections", &collections)?;

    Ok(collections)
}

pub async fn fetch_collections_offline(
    _hard_refresh: Option<bool>,
) -> Result<Collections, RemoteAccessError> {
    let mut cached = get_cached_object::<Collections>("collections")?;

    let db_handle = borrow_db_checked();

    for collection in cached.iter_mut() {
        collection.entries.retain(|v| {
            matches!(
                &db_handle
                    .applications
                    .game_statuses
                    .get(&v.game_id)
                    .unwrap_or(&GameDownloadStatus::Remote {}),
                GameDownloadStatus::Installed {
                    install_type: InstalledGameType::Installed | InstalledGameType::SetupRequired,
                    ..
                }
            )
        });
    }

    Ok(cached)
}
