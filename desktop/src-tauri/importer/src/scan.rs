//! Folder scan and client-side chunk hashing.
//!
//! The server's content-addressed store names every object by the SHA-256 of
//! raw fixed-size blocks (`server/server/utils/depot/chunker.ts`), which means
//! a client can compute the depot's exact object list before it ships a byte.
//! That equality is the whole economy of importing: the scan here must produce
//! digests that are byte-for-byte what `chunkFileToCas` would produce on the
//! server, or the depot would store the same bytes twice under two names.
//! The hermetic server suite pins this from the other side (importing a tree
//! digests exactly like publishing it from disk); the tests here pin it from
//! this side.

use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};

use rayon::prelude::*;
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

/// The server's fixed chunk size; a block boundary is part of the digest.
pub const CHUNK_SIZE: usize = 4 * 1024 * 1024;

#[derive(Debug, Clone)]
pub struct ScannedChunk {
    pub size: u32,
    pub sha256: String,
}

#[derive(Debug, Clone)]
pub struct ScannedFile {
    /// Logical manifest path: relative, forward slashes, traversal-free.
    pub rel_path: String,
    pub abs_path: PathBuf,
    pub size: u64,
    /// Permission bits for the manifest; the executable bit survives import.
    pub mode: u32,
    pub sha256: String,
    pub chunks: Vec<ScannedChunk>,
}

#[derive(Debug)]
pub struct ScanResult {
    pub files: Vec<ScannedFile>,
    pub total_bytes: u64,
}

#[derive(Debug, Clone)]
pub struct ScanProgress {
    pub files_done: usize,
    pub total_files: usize,
    pub bytes_hashed: u64,
    pub total_bytes: u64,
}

#[derive(Debug)]
pub enum ImportError {
    /// The folder (or something in it) cannot safely become a release.
    Unsafe(String),
    Io(String),
    Cancelled,
    Server {
        status: u16,
        message: String,
    },
    Network(String),
}

impl std::fmt::Display for ImportError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ImportError::Unsafe(m) => write!(f, "refusing to import: {m}"),
            ImportError::Io(m) => write!(f, "read error: {m}"),
            ImportError::Cancelled => write!(f, "import cancelled"),
            ImportError::Server { status, message } => {
                write!(f, "server rejected the import ({status}): {message}")
            }
            ImportError::Network(m) => write!(f, "network error: {m}"),
        }
    }
}

impl std::error::Error for ImportError {}

impl From<std::io::Error> for ImportError {
    fn from(value: std::io::Error) -> Self {
        ImportError::Io(value.to_string())
    }
}

/// Permission bits a manifest will carry for this file. Windows has no
/// meaningful mode, so anything runnable by name is published executable;
/// on Unix the real bits are carried over, and a game's `.exe`/`.dll` are
/// still forced executable because a Windows install restored onto a
/// case-sensitive Linux filesystem must stay launchable through Proton.
pub fn file_mode(path: &Path) -> u32 {
    let mut mode = {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::metadata(path)
                .map(|m| m.permissions().mode() & 0o7777)
                .unwrap_or(0o644)
        }
        #[cfg(not(unix))]
        {
            0o644
        }
    };
    if matches!(
        path.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()),
        Some(ext) if ext == "exe" || ext == "dll"
    ) {
        mode |= 0o111;
    }
    mode
}

/// Reject names the manifest cannot carry, mirroring the server: a backslash
/// would split one real file into two logical segments, a NUL breaks every
/// consumer. Failing here saves uploading a whole release into a 400.
fn check_file_name(name: &std::ffi::OsStr) -> Result<(), ImportError> {
    let text = name.to_string_lossy();
    if text.contains('\\') || text.contains('\0') {
        return Err(ImportError::Unsafe(format!(
            "file name {text:?} cannot be stored in a release"
        )));
    }
    Ok(())
}

/// Hash one file into whole-file digest + fixed-size chunk digests.
/// `on_bytes` is fed each hashed chunk so progress can breathe during a
/// hundred-gigabyte scan.
pub fn hash_file(
    abs: &Path,
    mut on_bytes: impl FnMut(usize),
) -> Result<(u64, String, Vec<ScannedChunk>), ImportError> {
    let mut file = File::open(abs)?;
    let mut whole = Sha256::new();
    let mut chunks: Vec<ScannedChunk> = Vec::new();
    let mut total = 0u64;
    loop {
        // Fill exactly one chunk (or the file's tail) before hashing it:
        // the block boundary is part of the digest, so a short read must
        // never end a chunk early.
        let mut buf: Vec<u8> = Vec::with_capacity(CHUNK_SIZE.min(64 * 1024 * 1024));
        let mut offset = 0usize;
        let mut eof = false;
        while offset < CHUNK_SIZE {
            let mut scratch = vec![0u8; (CHUNK_SIZE - offset).min(1024 * 1024)];
            let read = file.read(&mut scratch)?;
            if read == 0 {
                eof = true;
                break;
            }
            buf.extend_from_slice(&scratch[..read]);
            offset += read;
        }
        if buf.is_empty() {
            break;
        }
        let digest = {
            let mut h = Sha256::new();
            h.update(&buf);
            hex::encode(h.finalize())
        };
        whole.update(&buf);
        total += buf.len() as u64;
        chunks.push(ScannedChunk {
            size: buf.len() as u32,
            sha256: digest,
        });
        on_bytes(buf.len());
        if eof {
            break;
        }
    }
    Ok((total, hex::encode(whole.finalize()), chunks))
}

/// Walk a folder into a deterministic scan result: sorted by logical path,
/// symlinks and unsafe names refused outright (the server's own directory
/// publisher refuses them the same way - silence here would mean a release
/// that quietly installs short).
pub fn scan_folder(
    root: &Path,
    total_hint: Option<u64>,
    progress: Option<Arc<dyn Fn(ScanProgress) + Send + Sync>>,
) -> Result<ScanResult, ImportError> {
    let mut entries: Vec<(String, PathBuf)> = Vec::new();
    for entry in WalkDir::new(root).follow_links(false) {
        let entry = match entry {
            Ok(e) => e,
            Err(error) => return Err(ImportError::Io(error.to_string())),
        };
        if entry.depth() == 0 {
            continue;
        }
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .map_err(|e| ImportError::Io(e.to_string()))?;
        let mut rel = String::new();
        for part in relative.components() {
            match part {
                std::path::Component::Normal(name) => {
                    check_file_name(name)?;
                    if !rel.is_empty() {
                        rel.push('/');
                    }
                    rel.push_str(name.to_string_lossy().as_ref());
                }
                // Root/Prefix/ParentDir cannot appear under strip_prefix.
                _ => {
                    return Err(ImportError::Unsafe(format!(
                        "path {relative:?} cannot be stored in a release"
                    )));
                }
            }
        }
        if entry.file_type().is_symlink() {
            return Err(ImportError::Unsafe(format!(
                "{rel} is a symlink; its bytes would come from outside the release"
            )));
        }
        if entry.file_type().is_dir() {
            continue;
        }
        if !entry.file_type().is_file() {
            return Err(ImportError::Unsafe(format!(
                "{rel} is neither a file nor a directory"
            )));
        }
        // Sizes come from the hash pass; a runaway tree is capped by the
        // file count below and by the server's own size validation.
        entries.push((rel, path.to_path_buf()));
        if entries.len() > 200_000 {
            return Err(ImportError::Unsafe(
                "more than 200000 files in one release".into(),
            ));
        }
    }
    entries.sort_by(|a, b| a.0.cmp(&b.0));

    let total_files = entries.len();
    if total_files == 0 {
        return Err(ImportError::Unsafe(
            "no files to import under this folder".into(),
        ));
    }
    let files_done = Arc::new(AtomicUsize::new(0));
    let bytes_hashed = Arc::new(AtomicU64::new(0));
    let files: Vec<ScannedFile> = entries
        .into_par_iter()
        .map(|(rel, abs)| {
            let (size, sha256, chunks) = hash_file(&abs, {
                let bytes_hashed = bytes_hashed.clone();
                let progress = progress.clone();
                let files_done = files_done.clone();
                move |n| {
                    let done = bytes_hashed.fetch_add(n as u64, Ordering::Relaxed) + n as u64;
                    // ~64 MiB of breathing room between progress pings.
                    if done / (16 * CHUNK_SIZE as u64)
                        != (done - n as u64) / (16 * CHUNK_SIZE as u64)
                        && let Some(progress) = &progress
                    {
                        progress(ScanProgress {
                            files_done: files_done.load(Ordering::Relaxed),
                            total_files,
                            bytes_hashed: done,
                            total_bytes: total_hint.unwrap_or(0),
                        });
                    }
                }
            })?;
            let mode = file_mode(&abs);
            let done = files_done.fetch_add(1, Ordering::Relaxed) + 1;
            if let Some(progress) = &progress {
                progress(ScanProgress {
                    files_done: done,
                    total_files,
                    bytes_hashed: bytes_hashed.load(Ordering::Relaxed),
                    total_bytes: total_hint.unwrap_or(0),
                });
            }
            Ok(ScannedFile {
                rel_path: rel,
                abs_path: abs,
                size,
                mode,
                sha256,
                chunks,
            })
        })
        .collect::<Result<Vec<_>, ImportError>>()?;
    let total_bytes = files.iter().map(|f| f.size).sum();
    Ok(ScanResult { files, total_bytes })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("gd-importer-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn chunk_digests_match_the_known_sha256_vectors() {
        let root = temp_dir("vectors");
        fs::write(root.join("hello.txt"), b"hello").unwrap();
        fs::write(root.join("empty.bin"), b"").unwrap();
        let scan = scan_folder(&root, None, None).unwrap();

        let hello = scan
            .files
            .iter()
            .find(|f| f.rel_path == "hello.txt")
            .unwrap();
        // The SHA-256 of the five bytes spelling "hello", and of nothing.
        assert_eq!(
            hello.sha256,
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
        assert_eq!(hello.chunks.len(), 1);
        assert_eq!(
            hello.chunks[0].sha256, hello.sha256,
            "one chunk of a small file is the file digest"
        );
        assert_eq!(hello.chunks[0].size, 5);

        let empty = scan
            .files
            .iter()
            .find(|f| f.rel_path == "empty.bin")
            .unwrap();
        assert_eq!(
            empty.sha256,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert!(empty.chunks.is_empty());
        assert_eq!(empty.size, 0);
    }

    #[test]
    fn a_file_spanning_chunk_boundaries_splits_exactly() {
        let root = temp_dir("split");
        // CHUNK + 5 + a full extra chunk: sizes must be 4 MiB, 4 MiB, 5 with
        // the whole digest equal to hashing the concatenation.
        let mut data = vec![0xA5u8; CHUNK_SIZE * 2 + 5];
        for (i, b) in data.iter_mut().enumerate() {
            *b = b.wrapping_add(i as u8);
        }
        fs::write(root.join("big.bin"), &data).unwrap();
        let scan = scan_folder(&root, None, None).unwrap();
        let big = scan.files.iter().find(|f| f.rel_path == "big.bin").unwrap();

        assert_eq!(big.size, data.len() as u64);
        let sizes: Vec<u32> = big.chunks.iter().map(|c| c.size).collect();
        assert_eq!(sizes, vec![CHUNK_SIZE as u32, CHUNK_SIZE as u32, 5]);

        let mut whole = Sha256::new();
        whole.update(&data);
        assert_eq!(big.sha256, hex::encode(whole.finalize()));
        let mut first = Sha256::new();
        first.update(&data[..CHUNK_SIZE]);
        assert_eq!(big.chunks[0].sha256, hex::encode(first.finalize()));
        let mut tail = Sha256::new();
        tail.update(&data[CHUNK_SIZE * 2..]);
        assert_eq!(big.chunks[2].sha256, hex::encode(tail.finalize()));
    }

    #[test]
    fn identical_content_dedupes_by_digest_across_files() {
        let root = temp_dir("twins");
        fs::create_dir_all(root.join("sub")).unwrap();
        fs::write(root.join("a.bin"), b"twins").unwrap();
        fs::write(root.join("sub/b.bin"), b"twins").unwrap();
        let scan = scan_folder(&root, None, None).unwrap();
        assert_eq!(scan.files.len(), 2);
        assert_eq!(scan.files[0].sha256, scan.files[1].sha256);
        // Logical paths are relative and forward-slash separated, sorted.
        assert_eq!(scan.files[0].rel_path, "a.bin");
        assert_eq!(scan.files[1].rel_path, "sub/b.bin");
    }

    #[test]
    fn executables_are_published_runnable() {
        #[cfg(unix)]
        use std::os::unix::fs::PermissionsExt as _;
        let root = temp_dir("modes");
        fs::write(root.join("game.exe"), b"MZ").unwrap();
        fs::write(root.join("data.bin"), b"data").unwrap();
        #[cfg(unix)]
        fs::set_permissions(root.join("data.bin"), fs::Permissions::from_mode(0o600)).unwrap();
        let scan = scan_folder(&root, None, None).unwrap();
        let exe = scan
            .files
            .iter()
            .find(|f| f.rel_path == "game.exe")
            .unwrap();
        assert_eq!(exe.mode & 0o111, 0o111, "an .exe must arrive runnable");
        let data = scan
            .files
            .iter()
            .find(|f| f.rel_path == "data.bin")
            .unwrap();
        #[cfg(unix)]
        assert_eq!(data.mode, 0o600, "real unix bits ride along");
    }

    #[cfg(unix)]
    #[test]
    fn symlinks_and_unsafe_names_are_refused() {
        use std::os::unix::fs::symlink;

        let root = temp_dir("refusals");
        fs::write(root.join("real.bin"), b"x").unwrap();
        symlink(root.join("real.bin"), root.join("link.bin")).unwrap();
        let result = scan_folder(&root, None, None);
        assert!(matches!(result, Err(ImportError::Unsafe(_))));

        let root2 = temp_dir("names");
        fs::write(root2.join("weird\\name.bin"), b"x").unwrap();
        let result = scan_folder(&root2, None, None);
        assert!(matches!(result, Err(ImportError::Unsafe(_))));
    }

    #[test]
    fn an_empty_folder_refuses_to_scan() {
        let root = temp_dir("empty");
        assert!(matches!(
            scan_folder(&root, None, None),
            Err(ImportError::Unsafe(_))
        ));
    }
}
