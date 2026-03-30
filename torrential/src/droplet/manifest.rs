use std::{
    path::PathBuf,
    sync::{Arc, LazyLock},
};

use log::info;
use protobuf::Message;
use serde_json::json;
use tokio::{spawn, sync::Semaphore};

use crate::{
    proto::{
        core::{DropBoundType, TorrentialBound},
        droplet::{GenerateManifest, ManifestComplete, ManifestLog, ManifestProgress},
    },
    server::DropServer,
};

// TODO: re-write the droplet interface so it takes a 'static reference instead of an arc
static READER_SEMAPHORE: LazyLock<Arc<Semaphore>> = LazyLock::new(|| {
    let cores = std::env::var("READER_THREADS")
        .ok()
        .and_then(|v| str::parse::<usize>(&v).ok())
        .unwrap_or(num_cpus::get() / 2);
    info!("using {cores} import threads");
    Arc::new(Semaphore::new(cores))
});

pub async fn generate_manifest_rpc(
    server: Arc<DropServer>,
    message: TorrentialBound,
) -> Result<(), anyhow::Error> {
    let manifest_message = GenerateManifest::parse_from_bytes(&message.data)?;

    let manifest = droplet_rs::manifest::generate_manifest_rusty(
        &PathBuf::from(manifest_message.version_dir),
        |progress| {
            let mut progress_message = ManifestProgress::new();
            progress_message.progress = progress;

            let server = server.clone();
            let message_id = message.message_id.clone();
            spawn(async move {
                let _ = server
                    .send_message(
                        DropBoundType::MANIFEST_PROGRESS,
                        progress_message,
                        Some(message_id),
                    )
                    .await;
            });
        },
        |log_line| {
            let mut progress_log = ManifestLog::new();
            progress_log.log_line = log_line;

            let server = server.clone();
            let message_id = message.message_id.clone();
            spawn(async move {
                let _ = server
                    .send_message(DropBoundType::MANIFEST_LOG, progress_log, Some(message_id))
                    .await;
            });
        },
        Some(READER_SEMAPHORE.clone()),
    )
    .await?;

    let mut manifest_complete = ManifestComplete::new();
    manifest_complete.manifest = json!(manifest).to_string();

    server
        .send_message(
            DropBoundType::MANIFEST_COMPLETE,
            manifest_complete,
            Some(message.message_id),
        )
        .await?;

    Ok(())
}
