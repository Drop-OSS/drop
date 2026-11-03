use std::collections::HashMap;
use std::fs::{Permissions, set_permissions};
use std::io::SeekFrom;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::sync::Arc;
use std::time::Instant;

use aes::cipher::{KeyIvInit, StreamCipher};
use download_manager::error::ApplicationDownloadError;
use download_manager::util::download_thread_control_flag::{
    DownloadThreadControl, DownloadThreadControlFlag,
};
use download_manager::util::progress_object::ProgressHandle;
use droplet_types::ChunkData;
use futures_util::StreamExt as _;
use log::{debug, info};
use remote::auth::generate_authorization_header;
use remote::error::{DropServerError, RemoteAccessError};
use remote::utils::DROP_CLIENT_ASYNC;
use sha2::Digest;
use tauri::Url;
use tokio::io::{AsyncReadExt as _, AsyncSeekExt as _, AsyncWriteExt as _};
use tokio_util::io::StreamReader;

const READ_BUF_LEN: usize = 1024 * 1024;

type Aes128Ctr64LE = ctr::Ctr64LE<aes::Aes128>;

#[allow(clippy::too_many_arguments)]
pub async fn download_game_chunk(
    game_id: &str,
    version_id: &str,
    chunk_id: &str,
    depot: &str,
    key: &[u8; 16],
    chunk_data: &ChunkData,
    file_list: &HashMap<String, String>,
    base_path: &Path,
    control_flag: &DownloadThreadControl,
    // How much we're downloading
    download_progress: &ProgressHandle,
    // How much we're writing to disk
    disk_progress: &ProgressHandle,
) -> Result<bool, ApplicationDownloadError> {
    // If we're paused
    if control_flag.get() == DownloadThreadControlFlag::Stop {
        download_progress.set(0);
        disk_progress.set(0);
        return Ok(false);
    }

    let start = Instant::now();

    let header = generate_authorization_header();

    let url = Url::parse(depot)
        .map_err(|v| ApplicationDownloadError::DownloadError(v.into()))?
        .join(&format!("content/{}/{}/{}", game_id, version_id, chunk_id))
        .map_err(|v| ApplicationDownloadError::DownloadError(v.into()))?;

    let response = DROP_CLIENT_ASYNC
        .get(url)
        .header("Authorization", header)
        .send()
        .await
        .map_err(|e| ApplicationDownloadError::Communication(e.into()))?;

    if response.status() != 200 {
        info!("chunk request got status code: {}", response.status());
        let raw_res = response.text().await.map_err(|e| {
            ApplicationDownloadError::Communication(RemoteAccessError::FetchErrorLegacy(e.into()))
        })?;
        info!("{raw_res}");
        if let Ok(err) = serde_json::from_str::<DropServerError>(&raw_res) {
            return Err(ApplicationDownloadError::Communication(
                RemoteAccessError::InvalidResponse(err),
            ));
        }
        return Err(ApplicationDownloadError::Communication(
            RemoteAccessError::UnparseableResponse(raw_res),
        ));
    }

    if control_flag.get() == DownloadThreadControlFlag::Stop {
        download_progress.set(0);
        disk_progress.set(0);
        return Ok(false);
    }

    let timestep = start.elapsed().as_millis();

    debug!("took {}ms to start downloading", timestep);

    let stream = response
        .bytes_stream()
        .map(|v| v.map_err(std::io::Error::other));
    let mut stream_reader = StreamReader::new(stream);
    //let mut stream_reader = response;

    let mut hasher = sha2::Sha256::new();
    let mut cipher = Aes128Ctr64LE::new(key.into(), &chunk_data.iv.into());
    let mut read_buf = vec![0u8; READ_BUF_LEN];
    for file in &chunk_data.files {
        let should_write = file_list
            .get(&file.filename)
            .map(|v| v == version_id)
            .unwrap_or(false);
        let path = base_path.join(file.filename.clone());
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut file_handle = if should_write {
            let mut file_handle = tokio::fs::OpenOptions::new()
                .truncate(false)
                .write(true)
                .append(false)
                .create(true)
                .open(&path)
                .await?;
            file_handle
                .seek(SeekFrom::Start(file.start.try_into().unwrap()))
                .await?;
            Some(file_handle)
        } else {
            None
        };

        let mut remaining = file.length;
        while remaining > 0 {
            let amount = stream_reader
                .read(&mut read_buf[0..remaining.min(READ_BUF_LEN)])
                .await?;
            download_progress.add(amount);
            remaining -= amount;

            cipher.apply_keystream(&mut read_buf[0..amount]);
            hasher.update(&read_buf[0..amount]);
            if let Some(file_handle) = &mut file_handle {
                file_handle.write_all(&read_buf[0..amount]).await?;
                disk_progress.add(amount);
            }
        }

        #[cfg(unix)]
        {
            drop(file_handle);
            let permissions = if file.permissions == 0 {
                0o744
            } else {
                file.permissions
            };
            let permissions = Permissions::from_mode(permissions);
            set_permissions(path, permissions)
                .map_err(|e| ApplicationDownloadError::IoError(Arc::new(e)))?;
        }

        if control_flag.get() == DownloadThreadControlFlag::Stop {
            download_progress.set(0);
            return Ok(false);
        }
    }

    let digest = hex::encode(hasher.finalize());
    if digest != chunk_data.checksum {
        return Err(ApplicationDownloadError::Checksum);
    }

    Ok(true)
}
