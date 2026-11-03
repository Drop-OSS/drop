//! The content-addressed download source: `gamedepot-droplet` v1.
//!
//! Where the upstream (V2) path streams one encrypted multi-file bin and
//! writes it into the game files in a single pass, a v1 release is a JSON
//! manifest whose chunks are raw bytes named by the SHA-256 of exactly those
//! bytes. That inverts the order of operations in the healthy direction:
//!
//!   fetch chunk -> hash it -> only then may it be cached,
//!   assemble file from cached chunks in staging -> hash the file -> chmod
//!   from the manifest mode -> rename into place.
//!
//! So a chunk whose bytes are wrong never reaches the cache, and the name a
//! finished file carries is never one that is incomplete or corrupt. Chunks
//! deduplicate by digest across the whole download (and across releases,
//! since the cache is shared), and they survive restarts - which is what
//! makes resume cheap and a later delta patch a diff of digests.
//!
//! The chunk cache lives in the app cache dir (`<cache>/cas/<xx>/<sha256>`),
//! never in the install tree: the download prunes unknown files from the game
//! directory, and the same bytes can serve several games. Nothing evicts the
//! cache yet - cache lifecycle is a later roadmap item, matching the server,
//! which also keeps superseded chunks until garbage collection.

use std::collections::{HashMap, HashSet};
use std::io::SeekFrom;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::AtomicUsize;

use download_manager::error::ApplicationDownloadError;
use download_manager::util::download_thread_control_flag::{
    DownloadThreadControl, DownloadThreadControlFlag,
};
use download_manager::util::progress_object::{ProgressHandle, ProgressObject};
use futures_util::StreamExt as _;
use futures_util::stream::FuturesUnordered;
use log::{debug, info, warn};
use remote::auth::generate_authorization_header;
use remote::error::RemoteAccessError;
use remote::requests::generate_url;
use remote::utils::DROP_CLIENT_ASYNC;
use serde::Deserialize;
use sha2::Digest;
use tokio::io::{AsyncReadExt as _, AsyncSeekExt as _, AsyncWriteExt as _};
use tokio_util::io::StreamReader;

const READ_BUF_LEN: usize = 1024 * 1024;
const RETRY_COUNT: usize = 3;
static STAGING_DIR: &str = ".gd-cas-staging";

/// Ledger keys written into `.dropdata` contexts. The `cas:` prefix cannot
/// collide with an upstream chunk uuid, and a file key also carries a version
/// uuid and a path, so the two kinds cannot collide with each other either.
pub fn chunk_key(sha256: &str) -> String {
    format!("cas:chunk:{sha256}")
}
pub fn file_key(version_id: &str, path: &str) -> String {
    format!("cas:file:{version_id}:{path}")
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CasChunk {
    /// Offset within this file, not within the chunk store.
    pub offset: u64,
    pub size: u32,
    pub sha256: String,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CasFile {
    pub path: String,
    pub size: u64,
    pub sha256: String,
    /// Permission bits from the source; the executable bit is the reason
    /// this field exists at all.
    pub mode: u32,
    pub chunks: Vec<CasChunk>,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CasManifest {
    format: String,
    version: u32,
    pub files: Vec<CasFile>,
    #[allow(dead_code)]
    pub digest: String,
}

impl CasManifest {
    fn valid(&self) -> bool {
        self.format == "gamedepot-droplet" && self.version == 1
    }
}

/// Ask the server which v1 release this version was chunked into.
/// `None` means "this version is not chunked (or the server predates the
/// feature)" and the caller keeps using the upstream path - a missing v1
/// manifest is a normal answer, never a download failure.
pub async fn fetch_cas_manifest(
    version_id: &str,
) -> Result<Option<CasManifest>, ApplicationDownloadError> {
    let url = generate_url(
        &["/api/v1/client/depot/manifest"],
        &[("version", version_id)],
    )
    .map_err(ApplicationDownloadError::Communication)?;

    let response = DROP_CLIENT_ASYNC
        .get(url)
        .header("Authorization", generate_authorization_header())
        .send()
        .await
        .map_err(|e| ApplicationDownloadError::Communication(e.into()))?;

    if response.status() == 404 {
        return Ok(None);
    }
    if response.status() != 200 {
        let status = response.status();
        let raw = response.text().await.unwrap_or_default();
        return Err(ApplicationDownloadError::Communication(
            RemoteAccessError::ManifestDownloadFailed(status, raw),
        ));
    }

    let manifest: CasManifest = response
        .json()
        .await
        .map_err(|e| ApplicationDownloadError::Communication(e.into()))?;
    if !manifest.valid() {
        warn!("depot manifest for {version_id} is not a gamedepot-droplet v1 document");
        return Ok(None);
    }
    Ok(Some(manifest))
}

fn cache_object_path(cache_dir: &Path, sha256: &str) -> PathBuf {
    cache_dir.join("cas").join(&sha256[0..2]).join(sha256)
}

/// True when the object is in the cache with the size the manifest promises.
/// The byte-level truth is the digest, and [copy_cached_chunk] applies it
/// over exactly the bytes it copies.
fn chunk_cached(cache_dir: &Path, sha256: &str, size: u64) -> bool {
    match std::fs::metadata(cache_object_path(cache_dir, sha256)) {
        Ok(info) => info.is_file() && info.len() == size,
        Err(_) => false,
    }
}

/// Fetch one chunk into the cache, hashed before it is kept. Returns false
/// only when the download was asked to stop.
async fn fetch_cas_chunk(
    version_id: &str,
    sha256: &str,
    expected_size: u64,
    cache_dir: &Path,
    control_flag: &DownloadThreadControl,
    download_progress: &ProgressHandle,
) -> Result<bool, ApplicationDownloadError> {
    if control_flag.get() == DownloadThreadControlFlag::Stop {
        download_progress.set(0);
        return Ok(false);
    }

    let final_path = cache_object_path(cache_dir, sha256);
    // The part file is named with the pid: one chunk is fetched by one task
    // in one process at a time, and a stale part from a killed run is simply
    // truncated and rewritten, never mistaken for the object.
    let part_path = final_path.with_file_name(format!("{sha256}.{}.part", std::process::id()));
    if let Some(parent) = final_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let url = generate_url(&["/api/v1/client/depot/content", version_id, sha256], &[])
        .map_err(ApplicationDownloadError::Communication)?;

    let response = DROP_CLIENT_ASYNC
        .get(url)
        .header("Authorization", generate_authorization_header())
        .send()
        .await
        .map_err(|e| ApplicationDownloadError::Communication(e.into()))?;

    if response.status() != 200 {
        let status = response.status();
        let raw = response.text().await.unwrap_or_default();
        debug!("cas chunk {sha256} request got {status}: {raw}");
        return Err(ApplicationDownloadError::Communication(
            RemoteAccessError::UnparseableResponse(raw),
        ));
    }

    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&part_path)
        .await?;

    let stream = response
        .bytes_stream()
        .map(|v| v.map_err(std::io::Error::other));
    let mut stream_reader = StreamReader::new(stream);

    let mut hasher = sha2::Sha256::new();
    let mut written: u64 = 0;
    let mut read_buf = vec![0u8; READ_BUF_LEN];
    loop {
        let amount = stream_reader.read(&mut read_buf).await?;
        if amount == 0 {
            break;
        }
        if control_flag.get() == DownloadThreadControlFlag::Stop {
            drop(file);
            let _ = tokio::fs::remove_file(&part_path).await;
            download_progress.set(0);
            return Ok(false);
        }
        // Hash before writing anything on: the object file is only ever
        // published after the digest over every received byte matches.
        hasher.update(&read_buf[0..amount]);
        written += amount as u64;
        file.write_all(&read_buf[0..amount]).await?;
        download_progress.add(amount);
    }
    file.flush().await?;
    drop(file);

    let digest = hex::encode(hasher.finalize());
    if digest != sha256 || written != expected_size {
        let _ = tokio::fs::remove_file(&part_path).await;
        warn!("chunk {sha256} arrived as {digest} ({written} bytes)");
        return Err(ApplicationDownloadError::Checksum);
    }

    tokio::fs::rename(&part_path, &final_path).await?;
    Ok(true)
}

/// Stream one cached chunk into staging, re-hashing it while copying, so a
/// cache object mangled after the fact (a bad block, a hand-edited store)
/// fails here instead of being assembled into a game file - and gets deleted,
/// so the next attempt re-fetches it. Folds into the running file hash so the
/// caller needs no second read to verify the whole file.
async fn copy_cached_chunk(
    cache_dir: &Path,
    chunk: &CasChunk,
    staging: &mut tokio::fs::File,
    file_hasher: &mut sha2::Sha256,
    disk_progress: &ProgressHandle,
) -> Result<(), ApplicationDownloadError> {
    let object_path = cache_object_path(cache_dir, &chunk.sha256);
    let mut object = tokio::fs::File::open(&object_path).await?;
    staging.seek(SeekFrom::Start(chunk.offset)).await?;

    let mut hasher = sha2::Sha256::new();
    let mut remaining = chunk.size as u64;
    let mut read_buf = vec![0u8; READ_BUF_LEN];
    while remaining > 0 {
        let amount = object
            .read(&mut read_buf[0..remaining.min(READ_BUF_LEN as u64) as usize])
            .await?;
        if amount == 0 {
            warn!(
                "cached chunk {} is shorter than its manifest says",
                chunk.sha256
            );
            return Err(ApplicationDownloadError::Checksum);
        }
        hasher.update(&read_buf[0..amount]);
        file_hasher.update(&read_buf[0..amount]);
        staging.write_all(&read_buf[0..amount]).await?;
        disk_progress.add(amount);
        remaining -= amount as u64;
    }

    if hex::encode(hasher.finalize()) != chunk.sha256 {
        warn!("cached chunk {} no longer hashes to itself", chunk.sha256);
        let _ = tokio::fs::remove_file(&object_path).await;
        return Err(ApplicationDownloadError::Checksum);
    }
    Ok(())
}

/// Drop a half-assembled staging file (pause or a failed check): the final
/// path is only ever reached by a rename from a complete, verified file.
async fn abandon(staged: tokio::fs::File, staging_path: &Path) {
    drop(staged);
    let _ = tokio::fs::remove_file(staging_path).await;
}

/// Rebuild one file from cached chunks in staging; publish it (rename into
/// place, mode applied) only once its whole-file digest and size check pass.
/// An interrupted assembly leaves a part file in the staging directory -
/// pruned by the next run - never a half-written game file. Returns false
/// only when the download was asked to stop.
async fn assemble_cas_file(
    version_id: &str,
    file: &CasFile,
    cache_dir: &Path,
    base_path: &Path,
    control_flag: &DownloadThreadControl,
    // Network accounting, used only if a chunk turns out to be missing from
    // the cache and has to come back over the wire mid-assembly.
    download_progress: &ProgressHandle,
    disk_progress: &ProgressHandle,
) -> Result<bool, ApplicationDownloadError> {
    let final_path = base_path.join(&file.path);
    if let Some(parent) = final_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let staging_dir = base_path.join(STAGING_DIR);
    tokio::fs::create_dir_all(&staging_dir).await?;
    // A digest of version+path keeps one deterministic slot per file, so a
    // crash mid-assembly is overwritten cleanly rather than littered.
    let staged_name = format!(
        "{}.{}.part",
        hex::encode(sha2::Sha256::digest(
            format!("{version_id}:{}", file.path).as_bytes()
        )),
        std::process::id()
    );
    let staging_path = staging_dir.join(staged_name);

    let mut staged = tokio::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&staging_path)
        .await?;

    let mut file_hasher = sha2::Sha256::new();
    let mut assembled: u64 = 0;
    for chunk in &file.chunks {
        if control_flag.get() == DownloadThreadControlFlag::Stop {
            abandon(staged, &staging_path).await;
            return Ok(false);
        }
        // A missing cache object is re-fetched inline: the chunk phase may
        // have skipped it as already-done while the cache was cleaned since.
        // The manifest is the authority, the cache is not.
        if !chunk_cached(cache_dir, &chunk.sha256, chunk.size as u64) {
            let ok = fetch_cas_chunk(
                version_id,
                &chunk.sha256,
                chunk.size as u64,
                cache_dir,
                control_flag,
                download_progress,
            )
            .await?;
            if !ok {
                abandon(staged, &staging_path).await;
                return Ok(false);
            }
        }
        copy_cached_chunk(
            cache_dir,
            chunk,
            &mut staged,
            &mut file_hasher,
            disk_progress,
        )
        .await?;
        assembled += chunk.size as u64;
    }
    staged.flush().await?;
    drop(staged);

    let digest = hex::encode(file_hasher.finalize());
    if digest != file.sha256 || assembled != file.size {
        let _ = tokio::fs::remove_file(&staging_path).await;
        warn!(
            "assembled {} as {digest}/{assembled} bytes, manifest says {}/{}",
            file.path, file.sha256, file.size
        );
        return Err(ApplicationDownloadError::Checksum);
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = mode_of(file);
        std::fs::set_permissions(&staging_path, std::fs::Permissions::from_mode(mode))
            .map_err(|e| ApplicationDownloadError::IoError(Arc::new(e)))?;
    }

    tokio::fs::rename(&staging_path, &final_path).await?;
    debug!("assembled {} ({:o})", file.path, mode_of(file));
    Ok(true)
}

/// Sources published from Windows stores can carry mode 0; what an
/// installer must never produce is an unrunnable Linux build, so 0 lands on
/// the plain-file default rather than on nothing.
fn mode_of(file: &CasFile) -> u32 {
    if file.mode & 0o7777 == 0 {
        0o644
    } else {
        file.mode & 0o7777
    }
}

/// Everything run() needs to know about a download's v1 half, computed once
/// before any byte moves: the chunk fetch plan (deduplicated by digest over
/// the whole download, so a chunk shared by several files or versions is
/// pulled once) and the owned file list.
pub struct CasWork {
    /// One fetch task per distinct chunk: sha, size, a version that owns it.
    pub chunk_tasks: Vec<(String, u64, String)>,
    /// Files to assemble: owning version, manifest entry. Files a delta's
    /// other version owns are already filtered out.
    pub file_tasks: Vec<(String, CasFile)>,
    /// Chunk bytes still to fetch: not in the cache and not already done.
    pub needed_bytes: u64,
    /// Chunk bytes across the whole plan, cached or not: the honest
    /// denominator for the download progress bar.
    pub total_bytes: u64,
    /// Tasks counted for completion: chunk tasks plus file tasks.
    pub expected: usize,
}

pub fn plan(
    cas: &HashMap<String, CasManifest>,
    file_list: &HashMap<String, String>,
    cache_dir: &Path,
    already_done: &HashMap<String, bool>,
) -> CasWork {
    let mut seen_chunks: HashSet<String> = HashSet::new();
    let mut chunk_tasks = Vec::new();
    let mut file_tasks = Vec::new();
    let mut needed_bytes: u64 = 0;
    let mut total_bytes: u64 = 0;

    for (version_id, manifest) in cas {
        for file in &manifest.files {
            let owned = file_list
                .get(&file.path)
                .map(|v| v == version_id)
                .unwrap_or(false);
            if !owned {
                continue;
            }
            file_tasks.push((version_id.clone(), file.clone()));
            for chunk in &file.chunks {
                if !seen_chunks.insert(chunk.sha256.clone()) {
                    continue;
                }
                let size = chunk.size as u64;
                total_bytes += size;
                let done = already_done
                    .get(&chunk_key(&chunk.sha256))
                    .copied()
                    .unwrap_or(false);
                if !done && !chunk_cached(cache_dir, &chunk.sha256, size) {
                    needed_bytes += size;
                }
                chunk_tasks.push((chunk.sha256.clone(), size, version_id.clone()));
            }
        }
    }

    chunk_tasks.sort_by(|a, b| a.0.cmp(&b.0));
    file_tasks.sort_by(|a, b| a.1.path.cmp(&b.1.path));
    let expected = chunk_tasks.len() + file_tasks.len();
    CasWork {
        chunk_tasks,
        file_tasks,
        needed_bytes,
        total_bytes,
        expected,
    }
}

/// Drive both phases: bounded, parallel, resumable chunk fetches, then file
/// assembly (bounded too - local I/O, but staging writes still overlap).
/// Returns the ledger keys completed now plus whether anything stopped early;
/// the caller merges keys into `.dropdata` and treats a stop or an error as
/// "not finished" exactly like the upstream path does.
#[allow(clippy::too_many_arguments)]
pub async fn download(
    work: &CasWork,
    cache_dir: &Path,
    base_path: &Path,
    control_flag: &DownloadThreadControl,
    download_progress: &Arc<ProgressObject>,
    disk_progress: &Arc<ProgressObject>,
    already_done: &HashMap<String, bool>,
    max_threads: usize,
) -> Result<(Vec<String>, bool), ApplicationDownloadError> {
    let mut completed: Vec<String> = Vec::new();
    let mut stopped = false;
    let max_threads = max_threads.max(1);

    // Phase 1: chunks.
    let mut chunk_futures: FuturesUnordered<_> = FuturesUnordered::new();
    for (index, (sha256, size, version_id)) in work.chunk_tasks.iter().enumerate() {
        if already_done
            .get(&chunk_key(sha256))
            .copied()
            .unwrap_or(false)
            || chunk_cached(cache_dir, sha256, *size)
        {
            ProgressHandle::new(download_progress.get(index), download_progress.clone())
                .skip(*size as usize);
            completed.push(chunk_key(sha256));
            continue;
        }
        let download_handle =
            ProgressHandle::new(download_progress.get(index), download_progress.clone());
        while chunk_futures.len() >= max_threads {
            let outcome = chunk_futures
                .next()
                .await
                .expect("bounded set is never empty while full");
            collect(outcome, &mut completed, &mut stopped)?;
        }
        let (sha, size, version) = (sha256.clone(), *size, version_id.clone());
        chunk_futures.push(async move {
            for i in 0..RETRY_COUNT {
                match fetch_cas_chunk(
                    &version,
                    &sha,
                    size,
                    cache_dir,
                    control_flag,
                    &download_handle,
                )
                .await
                {
                    Ok(true) => return Ok(chunk_key(&sha)),
                    Ok(false) => return Ok(String::new()),
                    Err(e) => {
                        warn!("cas chunk {sha} attempt {i} failed: {e:?}");
                        if i == RETRY_COUNT - 1 {
                            return Err(e);
                        }
                    }
                }
            }
            Ok(String::new())
        });
    }
    while let Some(outcome) = chunk_futures.next().await {
        collect(outcome, &mut completed, &mut stopped)?;
    }

    // Phase 2: files. A stopped chunk phase simply means every assembly
    // returns at its first control-flag check; resume picks it up whole.
    let first_file_index = work.chunk_tasks.len();
    let mut file_futures: FuturesUnordered<_> = FuturesUnordered::new();
    for (index, (version_id, file)) in work.file_tasks.iter().enumerate() {
        let key = file_key(version_id, &file.path);
        if already_done.get(&key).copied().unwrap_or(false) {
            ProgressHandle::new(
                disk_progress.get(first_file_index + index),
                disk_progress.clone(),
            )
            .skip(file.size as usize);
            completed.push(key);
            continue;
        }
        let disk_handle = ProgressHandle::new(
            disk_progress.get(first_file_index + index),
            disk_progress.clone(),
        );
        while file_futures.len() >= max_threads {
            let outcome = file_futures
                .next()
                .await
                .expect("bounded set is never empty while full");
            collect(outcome, &mut completed, &mut stopped)?;
        }
        // Scratch counter for network bytes pulled inline when assembly
        // finds a cache miss; rare, and kept off the registered slots so the
        // chunk phase's accounting below stays exact.
        let download_handle =
            ProgressHandle::new(Arc::new(AtomicUsize::new(0)), download_progress.clone());
        let (version, file) = (version_id.clone(), file.clone());
        file_futures.push(async move {
            // One attempt: assembly from a verified cache is deterministic,
            // and missing input is already re-fetched inline, so retrying
            // would only re-hash the same bytes.
            match assemble_cas_file(
                &version,
                &file,
                cache_dir,
                base_path,
                control_flag,
                &download_handle,
                &disk_handle,
            )
            .await
            {
                Ok(true) => Ok(file_key(&version, &file.path)),
                Ok(false) => Ok(String::new()),
                Err(e) => Err(e),
            }
        });
    }
    while let Some(outcome) = file_futures.next().await {
        collect(outcome, &mut completed, &mut stopped)?;
    }

    if stopped {
        info!("content-addressed download stopped early");
    }
    Ok((completed, stopped))
}

fn collect(
    value: Result<String, ApplicationDownloadError>,
    completed: &mut Vec<String>,
    stopped: &mut bool,
) -> Result<(), ApplicationDownloadError> {
    match value {
        Ok(key) => {
            if key.is_empty() {
                *stopped = true;
            } else {
                completed.push(key);
            }
            Ok(())
        }
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use download_manager::util::progress_object::ProgressType;

    fn put_object(cache_dir: &Path, bytes: &[u8]) -> CasChunk {
        let sha = hex::encode(sha2::Sha256::digest(bytes));
        let path = cache_object_path(cache_dir, &sha);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, bytes).unwrap();
        CasChunk {
            offset: 0,
            size: bytes.len() as u32,
            sha256: sha,
        }
    }

    fn progress_pair() -> (Arc<ProgressObject>, ProgressHandle) {
        let (tx, _rx) = tokio::sync::mpsc::channel(1);
        let object = Arc::new(ProgressObject::new(0, 4, tx, ProgressType::Disk));
        object.set_size(4);
        let handle = ProgressHandle::new(object.get(0), object.clone());
        (object, handle)
    }

    fn scratch(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "gd-cas-test-{label}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[tokio::test]
    async fn a_file_is_published_only_after_the_whole_digest_checks_out() {
        let cache = scratch("cache");
        let base = scratch("install");

        let mut c0 = put_object(&cache, b"first chunk bytes");
        let mut c1 = put_object(&cache, b"tail");
        c1.offset = c0.size as u64;
        let content = [b"first chunk bytes".as_slice(), b"tail"].concat();
        let file = CasFile {
            path: "bin/run.sh".into(),
            size: content.len() as u64,
            sha256: hex::encode(sha2::Sha256::digest(&content)),
            mode: 0o755,
            chunks: vec![c0, c1],
        };

        let (_dl, disk) = progress_pair();
        let (_dl2, net) = progress_pair();
        let flag = DownloadThreadControl::new(DownloadThreadControlFlag::Go);
        let ok = assemble_cas_file("ver-1", &file, &cache, &base, &flag, &net, &disk)
            .await
            .unwrap();

        assert!(ok);
        let final_path = base.join("bin/run.sh");
        assert_eq!(std::fs::read(&final_path).unwrap(), content);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                std::fs::metadata(&final_path).unwrap().permissions().mode() & 0o777,
                0o755,
                "the manifest's executable bit survives assembly"
            );
        }
        // Nothing half-done is left behind.
        let staging = base.join(STAGING_DIR);
        assert_eq!(std::fs::read_dir(&staging).unwrap().count(), 0);
    }

    #[tokio::test]
    async fn a_mangled_cache_object_fails_the_build_and_is_evicted() {
        let cache = scratch("cache-corrupt");
        let base = scratch("install-corrupt");

        let chunk = put_object(&cache, b"aaaaaaaa");
        // Corrupt it after the fact, same length: bad block, hand-edit,
        // whatever. (A size change would be caught earlier and re-fetched;
        // this is the case where only the digest can catch it.)
        let object = cache_object_path(&cache, &chunk.sha256);
        std::fs::write(&object, b"bbbbbbbb").unwrap();

        let file = CasFile {
            path: "data.bin".into(),
            size: chunk.size as u64,
            sha256: hex::encode(sha2::Sha256::digest(b"aaaaaaaa")),
            mode: 0o644,
            chunks: vec![chunk],
        };

        let (_dl, disk) = progress_pair();
        let (_dl2, net) = progress_pair();
        let flag = DownloadThreadControl::new(DownloadThreadControlFlag::Go);
        let result = assemble_cas_file("ver-1", &file, &cache, &base, &flag, &net, &disk).await;

        assert!(matches!(result, Err(ApplicationDownloadError::Checksum)));
        assert!(!base.join("data.bin").exists(), "nothing is published");
        assert!(
            !object.exists(),
            "the corrupt object is deleted so the next pass refetches"
        );
    }

    #[tokio::test]
    async fn a_file_whose_chunks_do_not_answer_to_the_manifest_is_not_published() {
        let cache = scratch("cache-lie");
        let base = scratch("install-lie");

        let chunk = put_object(&cache, b"honest bytes");
        let file = CasFile {
            path: "lied.bin".into(),
            size: chunk.size as u64,
            // The manifest promises bytes the chunks do not add up to.
            sha256: hex::encode(sha2::Sha256::digest(b"different content")),
            mode: 0o644,
            chunks: vec![chunk],
        };

        let (_dl, disk) = progress_pair();
        let (_dl2, net) = progress_pair();
        let flag = DownloadThreadControl::new(DownloadThreadControlFlag::Go);
        let result = assemble_cas_file("ver-1", &file, &cache, &base, &flag, &net, &disk).await;

        assert!(matches!(result, Err(ApplicationDownloadError::Checksum)));
        assert!(!base.join("lied.bin").exists());
    }

    #[tokio::test]
    async fn an_empty_file_is_still_a_file() {
        let cache = scratch("cache-empty");
        let base = scratch("install-empty");
        let file = CasFile {
            path: "placeholder".into(),
            size: 0,
            sha256: hex::encode(sha2::Sha256::digest([])),
            mode: 0o644,
            chunks: vec![],
        };

        let (_dl, disk) = progress_pair();
        let (_dl2, net) = progress_pair();
        let flag = DownloadThreadControl::new(DownloadThreadControlFlag::Go);
        assert!(
            assemble_cas_file("ver-1", &file, &cache, &base, &flag, &net, &disk)
                .await
                .unwrap()
        );
        assert_eq!(std::fs::read(base.join("placeholder")).unwrap(), b"");
    }

    #[test]
    fn the_plan_dedupes_shared_chunks_and_only_owns_its_versions_files() {
        let cache = scratch("cache-plan");
        let shared = b"shared across files and versions";
        let shared_sha = hex::encode(sha2::Sha256::digest(shared));
        let shared_chunk = |offset: u64| CasChunk {
            offset,
            size: shared.len() as u32,
            sha256: shared_sha.clone(),
        };

        let manifest = |files: Vec<CasFile>| CasManifest {
            format: "gamedepot-droplet".into(),
            version: 1,
            files,
            digest: "x".into(),
        };
        let mut cas = HashMap::new();
        cas.insert(
            "vA".to_string(),
            manifest(vec![
                CasFile {
                    path: "a/one".into(),
                    size: shared.len() as u64 * 2,
                    sha256: "irrelevant".into(),
                    mode: 0o644,
                    chunks: vec![shared_chunk(0), shared_chunk(shared.len() as u64)],
                },
                // A file the *other* version of a delta owns: not our work.
                CasFile {
                    path: "shared/by-b".into(),
                    size: 1,
                    sha256: "x".into(),
                    mode: 0o644,
                    chunks: vec![],
                },
            ]),
        );
        cas.insert(
            "vB".to_string(),
            manifest(vec![CasFile {
                path: "shared/by-b".into(),
                size: 1,
                sha256: "x".into(),
                mode: 0o644,
                chunks: vec![CasChunk {
                    offset: 0,
                    size: 1,
                    sha256: hex::encode(sha2::Sha256::digest(b"b")),
                }],
            }]),
        );

        let mut file_list = HashMap::new();
        file_list.insert("a/one".to_string(), "vA".to_string());
        file_list.insert("shared/by-b".to_string(), "vB".to_string());

        let work = plan(&cas, &file_list, &cache, &HashMap::new());
        // vA: one distinct chunk (used twice), one file. vB: one chunk, one file.
        assert_eq!(
            work.chunk_tasks.len(),
            2,
            "the repeat chunk is not fetched twice"
        );
        assert_eq!(work.file_tasks.len(), 2);
        assert_eq!(work.expected, 4);
        assert_eq!(
            work.needed_bytes,
            shared.len() as u64 + 1,
            "nothing cached yet: everything is needed"
        );

        // Cache the shared chunk: needed_bytes must reflect exactly it.
        std::fs::create_dir_all(cache_object_path(&cache, &shared_sha).parent().unwrap()).unwrap();
        std::fs::write(cache_object_path(&cache, &shared_sha), shared).unwrap();
        let after = plan(&cas, &file_list, &cache, &HashMap::new());
        assert_eq!(
            after.needed_bytes, 1,
            "the cached chunk is already paid for"
        );
    }
}
