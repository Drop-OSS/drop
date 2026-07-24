use std::sync::nonpoison::Mutex;

use async_trait::async_trait;
use client::{app_state::AppState, app_status::AppStatus};
use database::{GameDownloadStatus, GameVersion, borrow_db_checked, borrow_db_mut_checked};
use log::warn;
use process::PROCESS_MANAGER;
use remote::utils::DROP_APP_HANDLE;
use tauri::Manager;

use crate::{
    games::{VersionDownloadOption, fetch_game_version_options},
    scheduler::ScheduleTask,
};

pub struct GameUpdater {
    no_internet: bool,
}

impl GameUpdater {
    pub fn new() -> Self {
        GameUpdater { no_internet: false }
    }
}

/*
This implementation is kinda inefficient because we can't hold the locks across await boundaries,
which means we constantly lock and unlock certain objects. It doesn't matter though, because this
doesn't have to be fast.
*/
#[async_trait]
impl ScheduleTask for GameUpdater {
    fn timeframe(&mut self) -> usize {
        if self.no_internet { 5 } else { 30 }
    }

    async fn call(&mut self) -> Result<(), anyhow::Error> {
        let app_handle = DROP_APP_HANDLE.lock().await;
        let app_handle = app_handle
            .as_ref()
            .ok_or(anyhow::anyhow!("game update task ran before setup"))?;
        let state = app_handle.state::<Mutex<AppState>>();
        {
            let state_lock = state.lock();
            if state_lock.status == AppStatus::Offline {
                self.no_internet = true;
                return Ok(());
            };
        };

        self.no_internet = false;

        let to_check: Vec<GameVersion> = {
            let db_lock = borrow_db_checked();

            db_lock
                .applications
                .game_statuses
                .values()
                .map(|v| match v {
                    GameDownloadStatus::Installed { version_id, .. } => Some(version_id),
                    _ => None,
                })
                .map(|v| {
                    v.and_then(|version_id| db_lock.applications.game_versions.get(version_id))
                })
                .filter(|v| {
                    v.map(|v| v.user_configuration.enable_updates)
                        .unwrap_or(false)
                })
                .map(|v| v.cloned().unwrap())
                .collect()
        };

        for version in to_check {
            let version_options =
                match fetch_game_version_options(version.game_id.clone(), state.clone()).await {
                    Ok(v) => v,
                    Err(err) => {
                        warn!(
                            "failed to check for update for game id {}: {:?}",
                            version.game_id, err
                        );
                        continue;
                    }
                };

            let process_manager_lock = PROCESS_MANAGER.lock();
            let valid_options: Vec<VersionDownloadOption> = version_options
                .into_iter()
                .filter(|v| process_manager_lock.valid_platform(&v.platform))
                .collect();

            let latest = match valid_options.first() {
                Some(v) => v,
                None => {
                    warn!("found no versions for game id: {}", version.game_id);
                    continue;
                }
            };
            let mut db_lock = borrow_db_mut_checked();
            let game_status = db_lock
                .applications
                .game_statuses
                .get_mut(&version.game_id)
                .ok_or(anyhow::anyhow!(""))?;

            if let GameDownloadStatus::Installed {
                update_available, ..
            } = game_status
            {
                *update_available = latest.version_id != version.version_id;
            };
        }

        Ok(())
    }
}
