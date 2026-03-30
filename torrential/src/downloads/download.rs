use std::{path::PathBuf, time::Instant};

use droplet_rs::{
    manifest::Manifest,
    versions::{create_backend_constructor, types::VersionBackend},
};
use log::warn;
use reqwest::StatusCode;
use serde_json::Value;

use crate::{
    conversions::convert_protobuf_manifest,
    proto::version::{VersionResponse, version_response::library_source::LibraryBackend},
    server::download::fetch_version_data,
    state::AppState,
    util::ErrorOption,
};

pub struct DownloadContext {
    pub(crate) manifest: Manifest,
    pub(crate) backend: Box<dyn VersionBackend + Send + Sync + 'static>,
    last_access: Instant,
}
impl DownloadContext {
    #[must_use] 
    pub fn last_access(&self) -> Instant {
        self.last_access
    }
    pub fn reset_last_access(&mut self) {
        self.last_access = Instant::now();
    }
}

pub async fn create_download_context(
    app_state: &AppState,
    game_id: String,
    version_name: String,
) -> Result<DownloadContext, ErrorOption> {
    let version_data = fetch_version_data(app_state, game_id, version_name.clone()).await?;

    let backend = create_backend(&version_data)?;

    let download_context = DownloadContext {
        manifest: convert_protobuf_manifest(version_data.manifest.unwrap()),
        backend,
        last_access: Instant::now(),
    };

    Ok(download_context)
}

fn create_backend(
    version_data: &VersionResponse,
) -> Result<Box<dyn VersionBackend + Send + Sync>, StatusCode> {
    let base_path = serde_json::from_str::<Value>(&version_data.source.options)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let base_path = base_path.get("baseDir").unwrap().as_str().unwrap();

    let version_path = PathBuf::from(base_path);
    let version_path = version_path.join(version_data.library_path.clone());
    let version_path = match version_data.source.backend.unwrap() {
        LibraryBackend::FILESYSTEM => version_path.join(version_data.version_path.clone()),
        LibraryBackend::FLAT_FILESYSTEM => version_path,
    };

    if !version_path.exists() {
        warn!("{} path doesn't exist for version", version_path.display());
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let backend =
        create_backend_constructor(&version_path).ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;

    let backend = backend()
        .inspect_err(|err| warn!("failed to create version backend: {err:?}"))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(backend)
}
