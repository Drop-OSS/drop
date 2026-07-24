#![feature(duration_millis_float)]
#![feature(nonpoison_mutex)]
#![feature(sync_nonpoison)]

use std::{ops::Deref, sync::OnceLock};

use tauri::AppHandle;

use crate::{
    download_manager_builder::DownloadManagerBuilder, download_manager_frontend::DownloadManager,
};

pub mod depot_manager;
pub mod download_manager_builder;
pub mod download_manager_frontend;
pub mod downloadable;
pub mod error;
pub mod frontend_updates;
pub mod util;

pub static DOWNLOAD_MANAGER: DownloadManagerWrapper = DownloadManagerWrapper::new();

pub struct DownloadManagerWrapper(OnceLock<DownloadManager>);
impl DownloadManagerWrapper {
    const fn new() -> Self {
        DownloadManagerWrapper(OnceLock::new())
    }
    pub fn init(app_handle: AppHandle) {
        DOWNLOAD_MANAGER
            .0
            .set(DownloadManagerBuilder::build(app_handle))
            .expect("failed to initialise download manager");
    }
}

impl Deref for DownloadManagerWrapper {
    type Target = DownloadManager;

    fn deref(&self) -> &Self::Target {
        match self.0.get() {
            Some(download_manager) => download_manager,
            None => unreachable!("Download manager should always be initialised"),
        }
    }
}
