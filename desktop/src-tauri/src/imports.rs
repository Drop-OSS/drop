//! Local-import commands: bring your own game files.
//!
//! Thin on purpose - the engine lives in the `importer` crate. What sits
//! here is the job table (so a running import can be cancelled), and the
//! single `import_state` event every open view listens to, mirroring how
//! cloud saves report progress.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::nonpoison::Mutex;
use std::sync::{Arc, LazyLock};

use database::db::DATA_ROOT_DIR;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use importer::{DetectedInstall, ImportError, ImportProgress, ImportRequest, run_import};

pub static IMPORT_JOBS: LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(Default::default);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImportEvent {
    job_id: String,
    game_title: String,
    #[serde(flatten)]
    progress: ImportProgress,
}

fn emit_state(app_handle: &AppHandle, event: &ImportEvent) {
    let _ = app_handle.emit("import_state", event);
}

/// Start importing a folder the player already owns into the depot.
/// Returns a job id; progress arrives on the `import_state` event and the
/// release appears as a game (or a new version of the named game) once the
/// server commits it. Publishing is admin-gated server-side; a non-admin
/// account gets a clean 403 back as the job's first event.
#[tauri::command]
pub async fn start_game_import(
    app_handle: AppHandle,
    folder: String,
    game_title: String,
    app_version: Option<String>,
    game_id: Option<String>,
    runs_standalone: Option<bool>,
) -> Result<String, String> {
    let job_id = format!("{:016x}", rand::random::<u64>());
    let cancel = Arc::new(AtomicBool::new(false));
    IMPORT_JOBS.lock().insert(job_id.clone(), cancel.clone());

    let device = gethostname::gethostname().to_string_lossy().to_string();
    let request = ImportRequest {
        folder,
        game_title: game_title.clone(),
        app_version,
        game_id,
        // Omitted means self-starting, the server's own default; the import
        // form sets it false for a legit EA/Rockstar/Ubisoft folder.
        runs_standalone: runs_standalone.unwrap_or(true),
    };

    let app = app_handle.clone();
    let job = job_id.clone();
    let title = game_title.clone();
    tauri::async_runtime::spawn(async move {
        let progress: Arc<dyn Fn(ImportProgress) + Send + Sync> = {
            let app = app.clone();
            let job = job.clone();
            let title = title.clone();
            Arc::new(move |p: ImportProgress| {
                emit_state(
                    &app,
                    &ImportEvent {
                        job_id: job.clone(),
                        game_title: title.clone(),
                        progress: p.clone(),
                    },
                );
            })
        };
        let result = run_import(request, Some(device), progress, cancel).await;
        IMPORT_JOBS.lock().remove(&job);
        if matches!(result, Err(ImportError::Cancelled)) {
            emit_state(
                &app,
                &ImportEvent {
                    job_id: job,
                    game_title: title,
                    progress: ImportProgress {
                        phase: "cancelled",
                        files_done: 0,
                        total_files: 0,
                        bytes_hashed: 0,
                        total_bytes: 0,
                        bytes_uploaded: 0,
                        upload_total: 0,
                        objects_done: 0,
                        total_objects: 0,
                        release_digest: None,
                        done: true,
                        error: None,
                    },
                },
            );
        }
    });

    Ok(job_id)
}

/// Ask a running import to stop at its next object boundary. Objects already
/// stored stay in the depot - content-addressed bytes are never wasted.
#[tauri::command]
pub fn cancel_game_import(job_id: String) -> bool {
    if let Some(cancel) = IMPORT_JOBS.lock().get(&job_id) {
        cancel.store(true, Ordering::Relaxed);
        return true;
    }
    false
}

/// What the storefronts on this machine say they installed.
///
/// Detection reads the files a launcher left behind, not its services, so it
/// works offline and when nobody is signed in. It only prefills the import
/// form: nothing reaches the depot until a player - an admin - presses Import.
///
/// `extra_prefixes` lets a view add Wine/umu prefix directories beyond the
/// ones Drop creates itself.
#[tauri::command]
pub async fn detect_launcher_installs(
    extra_prefixes: Option<Vec<String>>,
) -> Result<Vec<DetectedInstall>, String> {
    let mut roots: Vec<PathBuf> = Vec::new();
    let own = DATA_ROOT_DIR.join("pfx");
    if let Ok(entries) = std::fs::read_dir(&own) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                roots.push(path);
            }
        }
    }
    roots.extend(
        extra_prefixes
            .unwrap_or_default()
            .into_iter()
            .map(PathBuf::from)
            .filter(|p| p.is_dir()),
    );

    // The scan walks game folders, which is disk work worth keeping off the
    // reactor.
    tauri::async_runtime::spawn_blocking(move || importer::detect_installs(&roots))
        .await
        .map_err(|e| e.to_string())
}
