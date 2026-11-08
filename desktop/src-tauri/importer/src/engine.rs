//! The import session client: declare, ship the missing, commit.
//!
//! One economy rule drives this whole module: the depot answers a
//! declaration with the *objects it lacks*, so the client uploads only the
//! diff - a first import pays for its bytes, and every later resync after a
//! launcher patch pays only for what the patch changed. The server side
//! (`server/server/utils/import/session.ts`) re-hashes every arriving object,
//! so a wrong byte anywhere fails at that object, never as a broken release.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

use futures_util::StreamExt as _;
use log::{info, warn};
use remote::auth::generate_authorization_header;
use remote::error::RemoteAccessError;
use remote::requests::generate_url;
use remote::utils::DROP_CLIENT_ASYNC;
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt as _, AsyncSeekExt as _};

use crate::scan::{ImportError, ScanProgress, ScannedFile, scan_folder};

const UPLOAD_CONCURRENCY: usize = 3;
const RETRIES: usize = 3;

#[derive(Serialize)]
struct ChunkDecl {
    size: u64,
    sha256: String,
}

#[derive(Serialize)]
struct FileDecl {
    path: String,
    size: u64,
    mode: u32,
    sha256: String,
    chunks: Vec<ChunkDecl>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenRequest<'a> {
    game_title: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    app_version: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    game_id: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    device: Option<&'a str>,
    /// Declared to the server: whether the release starts on its own. False
    /// for a legit EA/Rockstar/Ubisoft folder the store client must launch.
    runs_standalone: bool,
    files: Vec<FileDecl>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct OpenResponse {
    session_id: String,
    release_digest: String,
    total_bytes: u64,
    total_objects: u64,
    #[allow(dead_code)]
    missing_objects: u64,
    missing: Vec<String>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct UploadResponse {
    stored: bool,
    deduped: bool,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportOutcome {
    pub digest: String,
    pub game_id: String,
    pub version_id: String,
    pub file_count: u64,
    pub chunk_count: u64,
    pub total_bytes: u64,
    pub uploaded_objects: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportRequest {
    pub folder: String,
    pub game_title: String,
    #[serde(default)]
    pub app_version: Option<String>,
    #[serde(default)]
    pub game_id: Option<String>,
    /// Whether the build starts on its own (true, the default). See the
    /// launcher-handoff note on `OpenRequest`.
    #[serde(default = "default_true")]
    pub runs_standalone: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgress {
    pub phase: &'static str,
    pub files_done: usize,
    pub total_files: usize,
    pub bytes_hashed: u64,
    pub total_bytes: u64,
    pub bytes_uploaded: u64,
    pub upload_total: u64,
    pub objects_done: u64,
    pub total_objects: u64,
    pub release_digest: Option<String>,
    pub done: bool,
    pub error: Option<String>,
}

fn base_progress() -> ImportProgress {
    ImportProgress {
        phase: "hashing",
        files_done: 0,
        total_files: 0,
        bytes_hashed: 0,
        total_bytes: 0,
        bytes_uploaded: 0,
        upload_total: 0,
        objects_done: 0,
        total_objects: 0,
        release_digest: None,
        done: false,
        error: None,
    }
}

impl From<RemoteAccessError> for ImportError {
    fn from(value: RemoteAccessError) -> Self {
        ImportError::Network(value.to_string())
    }
}

async fn server_error(response: reqwest::Response) -> ImportError {
    // The client event-handler error shape is { message }; tolerate anything.
    let status = response.status().as_u16();
    let text = response.text().await.unwrap_or_default();
    let message = serde_json::from_str::<serde_json::Value>(&text)
        .ok()
        .and_then(|v| {
            v.get("message")
                .and_then(|m| m.as_str())
                .map(str::to_string)
        })
        .filter(|m| !m.is_empty())
        .unwrap_or_else(|| text.chars().take(300).collect::<String>());
    ImportError::Server { status, message }
}

/// Hash the whole folder into release declarations, off the async reactor.
async fn scan_for_import(
    folder: PathBuf,
    progress: Arc<dyn Fn(ScanProgress) + Send + Sync>,
) -> Result<Vec<ScannedFile>, ImportError> {
    tokio::task::spawn_blocking(move || scan_folder(&folder, None, Some(progress)))
        .await
        .map_err(|e| ImportError::Io(e.to_string()))?
        .map(|scan| scan.files)
}

async fn open_session(
    files: &[ScannedFile],
    request: &ImportRequest,
    device: Option<&str>,
) -> Result<OpenResponse, ImportError> {
    let decls: Vec<FileDecl> = files
        .iter()
        .map(|f| FileDecl {
            path: f.rel_path.clone(),
            size: f.size,
            mode: f.mode,
            sha256: f.sha256.clone(),
            chunks: f
                .chunks
                .iter()
                .map(|c| ChunkDecl {
                    size: c.size as u64,
                    sha256: c.sha256.clone(),
                })
                .collect(),
        })
        .collect();
    let url = generate_url(&["/api/v1/client/depot/import/session"], &[])?;
    let body = OpenRequest {
        game_title: &request.game_title,
        app_version: request.app_version.as_deref(),
        game_id: request.game_id.as_deref(),
        device,
        runs_standalone: request.runs_standalone,
        files: decls,
    };
    let response = DROP_CLIENT_ASYNC
        .post(url)
        .header("Authorization", generate_authorization_header())
        .json(&body)
        .send()
        .await
        .map_err(|e| ImportError::Network(e.to_string()))?;
    if !response.status().is_success() {
        return Err(server_error(response).await);
    }
    response
        .json()
        .await
        .map_err(|e| ImportError::Network(e.to_string()))
}

/// Read one object's bytes out of its source file. The declared size is the
/// only length trusted; the server re-hashes every byte regardless.
async fn read_chunk(abs: &Path, offset: u64, size: u32) -> Result<Vec<u8>, ImportError> {
    let mut file = tokio::fs::File::open(abs)
        .await
        .map_err(|e| ImportError::Io(e.to_string()))?;
    file.seek(std::io::SeekFrom::Start(offset))
        .await
        .map_err(|e| ImportError::Io(e.to_string()))?;
    let mut buf = Vec::with_capacity(size as usize);
    file.take(size as u64)
        .read_to_end(&mut buf)
        .await
        .map_err(|e| ImportError::Io(e.to_string()))?;
    if buf.len() != size as usize {
        return Err(ImportError::Io(format!(
            "{}:{} shrank between scan and upload",
            abs.display(),
            offset
        )));
    }
    Ok(buf)
}

async fn upload_object_once(
    session_id: &str,
    digest: &str,
    bytes: Vec<u8>,
) -> Result<UploadResponse, ImportError> {
    let url = generate_url(
        &["/api/v1/client/depot/import/session", session_id, "objects"],
        &[],
    )?;
    let response = DROP_CLIENT_ASYNC
        .post(url)
        .header("Authorization", generate_authorization_header())
        .header("x-content-sha256", digest)
        .body(bytes)
        .send()
        .await
        .map_err(|e| ImportError::Network(e.to_string()))?;
    if !response.status().is_success() {
        return Err(server_error(response).await);
    }
    response
        .json()
        .await
        .map_err(|e| ImportError::Network(e.to_string()))
}

async fn commit_session(session_id: &str) -> Result<ImportOutcome, ImportError> {
    let url = generate_url(
        &["/api/v1/client/depot/import/session", session_id, "commit"],
        &[],
    )?;
    let response = DROP_CLIENT_ASYNC
        .post(url)
        .header("Authorization", generate_authorization_header())
        .send()
        .await
        .map_err(|e| ImportError::Network(e.to_string()))?;
    if !response.status().is_success() {
        return Err(server_error(response).await);
    }
    response
        .json()
        .await
        .map_err(|e| ImportError::Network(e.to_string()))
}

pub async fn cancel_session(session_id: &str) -> Result<(), ImportError> {
    let url = generate_url(&["/api/v1/client/depot/import/session", session_id], &[])?;
    let response = DROP_CLIENT_ASYNC
        .delete(url)
        .header("Authorization", generate_authorization_header())
        .send()
        .await
        .map_err(|e| ImportError::Network(e.to_string()))?;
    if !response.status().is_success() {
        return Err(server_error(response).await);
    }
    Ok(())
}

/// Every distinct object digest maps to the first place that carries it.
/// Chunks are fixed-size blocks read in order, so an object's offset is the
/// sum of the sizes before it within its file.
fn object_sources(files: &[ScannedFile]) -> HashMap<String, (PathBuf, u64, u32)> {
    let mut map: HashMap<String, (PathBuf, u64, u32)> = HashMap::new();
    for file in files {
        let mut offset = 0u64;
        for chunk in &file.chunks {
            map.entry(chunk.sha256.clone())
                .or_insert_with(|| (file.abs_path.clone(), offset, chunk.size));
            offset += chunk.size as u64;
        }
    }
    map
}

/// Run one import end to end. `progress` may be called from any thread;
/// `cancel` is polled at every object boundary.
pub async fn run_import(
    request: ImportRequest,
    device: Option<String>,
    progress: Arc<dyn Fn(ImportProgress) + Send + Sync>,
    cancel: Arc<AtomicBool>,
) -> Result<ImportOutcome, ImportError> {
    let fail = |e: &ImportError| {
        let mut p = base_progress();
        p.phase = "failed";
        p.done = true;
        p.error = Some(e.to_string());
        (*progress)(p);
    };

    let result = run_import_inner(&request, device.as_deref(), &progress, &cancel).await;
    if let Err(e) = &result
        && !matches!(e, ImportError::Cancelled)
    {
        fail(e);
    }
    result
}

async fn run_import_inner(
    request: &ImportRequest,
    device: Option<&str>,
    progress: &Arc<dyn Fn(ImportProgress) + Send + Sync>,
    cancel: &Arc<AtomicBool>,
) -> Result<ImportOutcome, ImportError> {
    if cancel.load(Ordering::Relaxed) {
        return Err(ImportError::Cancelled);
    }

    let files = scan_for_import(
        PathBuf::from(&request.folder),
        Arc::new({
            let progress = progress.clone();
            move |s: ScanProgress| {
                let mut p = base_progress();
                p.phase = "hashing";
                p.files_done = s.files_done;
                p.total_files = s.total_files;
                p.bytes_hashed = s.bytes_hashed;
                p.total_bytes = s.total_bytes;
                (*progress)(p);
            }
        }),
    )
    .await?;
    if cancel.load(Ordering::Relaxed) {
        return Err(ImportError::Cancelled);
    }

    let opened = open_session(&files, request, device).await?;
    // Destructure now: the upload futures own copies of the session's
    // identity and totals, so nothing borrows `opened` across the drain.
    let session_id = opened.session_id;
    let release_digest = opened.release_digest;
    let release_bytes = opened.total_bytes;
    let total_objects = opened.total_objects;
    let missing = opened.missing;

    let sources = object_sources(&files);
    let total_files = files.len();

    // The missing list is the entire upload plan; a resync of unchanged
    // files plans zero transfers by construction.
    let mut plan: Vec<(String, PathBuf, u64, u32)> = Vec::with_capacity(missing.len());
    for digest in &missing {
        let (abs, offset, size) = sources.get(digest).cloned().ok_or_else(|| {
            ImportError::Io(format!(
                "server wants object {digest} the scan did not declare"
            ))
        })?;
        plan.push((digest.clone(), abs, offset, size));
    }
    let upload_total: u64 = plan.iter().map(|(_, _, _, size)| *size as u64).sum();
    info!(
        "import session {session_id}: {} missing objects, {} to upload",
        plan.len(),
        upload_total
    );

    if !plan.is_empty() {
        let bytes_uploaded = Arc::new(AtomicU64::new(0));
        let objects_done = Arc::new(AtomicU64::new(0));
        let upload_progress = progress.clone();
        let emit_digest = release_digest.clone();
        // One shared closure; each upload future holds an Arc handle to it.
        let emit_upload = Arc::new(move |up: u64, objs: u64| {
            let mut p = base_progress();
            p.phase = "uploading";
            p.files_done = total_files;
            p.total_files = total_files;
            p.bytes_hashed = release_bytes;
            p.total_bytes = release_bytes;
            p.bytes_uploaded = up;
            p.upload_total = upload_total;
            p.objects_done = objs;
            p.total_objects = total_objects;
            p.release_digest = Some(emit_digest.clone());
            (*upload_progress)(p);
        });

        let stream_session_id = session_id.clone();
        let mut queue = futures_util::stream::iter(
            plan.into_iter().map(move |(digest, abs, offset, size)| {
                let session_id = stream_session_id.clone();
                let bytes_uploaded = bytes_uploaded.clone();
                let objects_done = objects_done.clone();
                let emit = emit_upload.clone();
                let cancel = cancel.clone();
                async move {
                    if cancel.load(Ordering::Relaxed) {
                        return Err(ImportError::Cancelled);
                    }
                    let mut last: Option<ImportError> = None;
                    for _ in 0..RETRIES {
                        match read_chunk(&abs, offset, size).await {
                            Ok(bytes) => match upload_object_once(&session_id, &digest, bytes).await
                            {
                                Ok(reply) => {
                                    // Both true-states are fine (new object, or
                                    // another upload got there first); anything
                                    // else means the store is not telling the truth.
                                    if !reply.stored && !reply.deduped {
                                        warn!(
                                            "object {digest} uploaded but the store reported neither stored nor deduped"
                                        );
                                    }
                                    let up = bytes_uploaded
                                        .fetch_add(size as u64, Ordering::Relaxed)
                                        + size as u64;
                                    let objs = objects_done.fetch_add(1, Ordering::Relaxed) + 1;
                                    emit(up, objs);
                                    return Ok(());
                                }
                                Err(ImportError::Network(e)) => {
                                    last = Some(ImportError::Network(e));
                                }
                                Err(other) => return Err(other),
                            },
                            Err(e @ ImportError::Io(_)) => last = Some(e),
                            Err(other) => return Err(other),
                        }
                    }
                    Err(last
                        .unwrap_or_else(|| ImportError::Network("object upload exhausted".into())))
                }
            }),
        )
        .buffer_unordered(UPLOAD_CONCURRENCY);

        while let Some(result) = queue.next().await {
            if let Err(e) = result {
                let _ = cancel_session(&session_id).await;
                return Err(e);
            }
        }
    }

    if cancel.load(Ordering::Relaxed) {
        let _ = cancel_session(&session_id).await;
        return Err(ImportError::Cancelled);
    }

    {
        let mut p = base_progress();
        p.phase = "committing";
        p.files_done = total_files;
        p.total_files = total_files;
        p.bytes_hashed = release_bytes;
        p.total_bytes = release_bytes;
        p.upload_total = upload_total;
        p.total_objects = total_objects;
        p.release_digest = Some(release_digest.clone());
        (**progress)(p);
    }

    let outcome = commit_session(&session_id).await?;

    {
        let mut p = base_progress();
        p.phase = "done";
        p.files_done = outcome.file_count as usize;
        p.total_files = outcome.file_count as usize;
        p.bytes_hashed = outcome.total_bytes;
        p.total_bytes = outcome.total_bytes;
        p.bytes_uploaded = upload_total;
        p.upload_total = upload_total;
        p.objects_done = outcome.chunk_count;
        p.total_objects = outcome.chunk_count;
        p.release_digest = Some(outcome.digest.clone());
        p.done = true;
        (**progress)(p);
    }
    info!(
        "import published {} as game {} version {}",
        outcome.digest, outcome.game_id, outcome.version_id
    );
    Ok(outcome)
}

/// Chunks are fixed-size blocks read in order; the offset of one inside its
/// file is the sum of the sizes before it.
pub fn chunk_offset(file: &ScannedFile, chunk_index: usize) -> u64 {
    file.chunks[..chunk_index]
        .iter()
        .map(|c| c.size as u64)
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scan::ScannedChunk;

    fn file(abs: &str, chunks: Vec<(&str, u32)>) -> ScannedFile {
        ScannedFile {
            rel_path: "f.bin".into(),
            abs_path: PathBuf::from(abs),
            size: chunks.iter().map(|(_, s)| *s as u64).sum(),
            mode: 0o644,
            sha256: "whole".into(),
            chunks: chunks
                .into_iter()
                .map(|(d, s)| ScannedChunk {
                    sha256: d.into(),
                    size: s,
                })
                .collect(),
        }
    }

    #[test]
    fn object_sources_map_to_the_first_carrier_and_correct_offsets() {
        let files = vec![
            file("/a.bin", vec![("d1", 4), ("shared", 4), ("d2", 2)]),
            file("/b.bin", vec![("shared", 4), ("d3", 1)]),
        ];
        let map = object_sources(&files);
        assert_eq!(map.len(), 4, "deduped across files");
        assert_eq!(
            map["shared"],
            (PathBuf::from("/a.bin"), 4, 4),
            "first carrier wins, offset is the sum of the blocks before it"
        );
        assert_eq!(map["d2"], (PathBuf::from("/a.bin"), 8, 2));
        assert_eq!(map["d3"], (PathBuf::from("/b.bin"), 4, 1));
    }

    #[test]
    fn chunk_offsets_are_the_sizes_before_them() {
        let f = file("/a.bin", vec![("d1", 4), ("d2", 4), ("d3", 1)]);
        assert_eq!(chunk_offset(&f, 0), 0);
        assert_eq!(chunk_offset(&f, 1), 4);
        assert_eq!(chunk_offset(&f, 2), 8);
    }
}
