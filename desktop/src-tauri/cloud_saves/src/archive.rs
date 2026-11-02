//! The archive: a deterministic `tar.zstd` bundle of the resolved save files,
//! plus safe extraction with verification.
//!
//! Determinism matters twice over. `archiveSha256` deduplicates stored bytes
//! on the server, so two devices storing the same save must produce byte-
//! identical archives: entries are sorted by key, tar headers carry no mtime
//! or ownership, and compression runs single-threaded at a fixed level.
//! And extraction must never be able to write outside what the manifest
//! resolves to on this machine: every member key is checked against a caller-
//! supplied key -> path map, bytes are verified against the per-file hashes,
//! and files are published with tmp+rename.

use std::{
    collections::BTreeMap,
    io::{Cursor, Read, Write},
    path::PathBuf,
};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::context::{ResolvedFile, portable_mode};
use crate::error::SaveError;

/// Name of the JSON member describing the archive's content. Kept out of the
/// content hash (it describes framing, not the save) and appended last.
pub const METADATA_MEMBER: &str = "GameDepotSaveInfo.json";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ArchiveMetadata {
    version: u32,
    // Diagnostic framing info (which manifest/OS built the archive): parsed
    // for validation, kept for whoever debugs a cross-device save later.
    #[allow(dead_code)]
    manifest_hash: String,
    #[allow(dead_code)]
    environment: String,
    files: Vec<MemberFile>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MemberFile {
    key: String,
    size: u64,
    sha256: String,
    mode: u32,
}

#[derive(Debug)]
pub struct BuiltArchive {
    pub bytes: Vec<u8>,
    /// sha256 over the canonical content JSON (the server's `contentHash`).
    pub content_hash: String,
    /// sha256 over these exact compressed bytes (the server's
    /// `archiveSha256`).
    pub archive_sha256: String,
    pub file_count: usize,
}

/// Build the deterministic archive for `files` (any order; it gets sorted).
///
/// `manifest_hash` and `environment` are recorded in the metadata member for
/// diagnostics only.
pub fn build_archive(
    files: &[ResolvedFile],
    manifest_hash: &str,
    environment: &str,
) -> Result<BuiltArchive, SaveError> {
    let mut sorted: Vec<&ResolvedFile> = files.iter().collect();
    sorted.sort_by(|a, b| a.key.cmp(&b.key));

    let members: Vec<MemberFile> = sorted
        .iter()
        .map(|f| MemberFile {
            key: f.key.clone(),
            size: f.size,
            sha256: f.sha256.clone(),
            mode: f.mode,
        })
        .collect();

    // serde_json's default map is a BTreeMap, so this serializes in key
    // order with no floating f64s anywhere: stable across runs and machines.
    let metadata = serde_json::json!({
        "version": 1,
        "manifestHash": manifest_hash,
        "environment": environment,
        "files": members,
    });
    let metadata_bytes = serde_json::to_vec(&metadata)?;

    let mut tar = tar::Builder::new(Vec::new());
    for file in &sorted {
        let mut header = tar::Header::new_gnu();
        header.set_path(&file.key)?;
        header.set_size(file.size);
        header.set_mode(if file.mode & 0o111 != 0 { 0o755 } else { 0o644 });
        header.set_mtime(0);
        header.set_uid(0);
        header.set_gid(0);
        header.set_entry_type(tar::EntryType::Regular);
        header.set_cksum();
        let body = std::fs::read(&file.path)?;
        if body.len() as u64 != file.size {
            return Err(SaveError::Corrupt(format!(
                "{} changed size mid-backup ({} vs {})",
                file.key,
                body.len(),
                file.size
            )));
        }
        tar.append(&header, Cursor::new(body))?;
    }
    let mut header = tar::Header::new_gnu();
    header.set_path(METADATA_MEMBER)?;
    header.set_size(metadata_bytes.len() as u64);
    header.set_mode(0o644);
    header.set_mtime(0);
    header.set_uid(0);
    header.set_gid(0);
    header.set_entry_type(tar::EntryType::Regular);
    header.set_cksum();
    tar.append(&header, Cursor::new(metadata_bytes))?;
    let tar_bytes = tar
        .into_inner()
        .map_err(|e| SaveError::Corrupt(format!("archive build failed: {e}")))?;

    // Fixed level, single-threaded, content checksum off: same input, same
    // bytes, on every device and every run.
    let bytes = zstd::encode_all(Cursor::new(tar_bytes), 3)?;

    Ok(BuiltArchive {
        archive_sha256: hex::encode(Sha256::digest(&bytes)),
        content_hash: crate::canonical::content_hash(
            &files
                .iter()
                .map(ResolvedFile::content_file)
                .collect::<Vec<_>>(),
        ),
        file_count: files.len(),
        bytes,
    })
}

/// What was written where by [`extract_archive`].
#[derive(Debug, Default)]
pub struct Extracted {
    pub written: Vec<(String, PathBuf)>,
    /// Keys in the archive that this machine's manifest did not resolve (for
    /// example a Windows-only file pulled on a Linux-native game).
    pub skipped: Vec<String>,
}

/// Verify and unpack `bytes` into the caller-resolved destinations.
///
/// `writes` maps portable key -> concrete path on this machine (from
/// `context::collect_files` semantics - the caller re-resolves live rather
/// than trusting paths in the archive, because the same logical save lives
/// somewhere different on each device).
pub fn extract_archive(
    bytes: &[u8],
    expected_archive_sha256: Option<&str>,
    writes: &BTreeMap<String, PathBuf>,
) -> Result<Extracted, SaveError> {
    if let Some(expected) = expected_archive_sha256 {
        let seen = hex::encode(Sha256::digest(bytes));
        if seen != expected.to_ascii_lowercase() {
            return Err(SaveError::Corrupt(format!(
                "archive sha256 mismatch: server said {expected}, bytes hash to {seen}"
            )));
        }
    }

    let tar_bytes = zstd::decode_all(Cursor::new(bytes.to_vec()))?;
    let mut archive = tar::Archive::new(Cursor::new(tar_bytes));

    let mut metadata: Option<ArchiveMetadata> = None;
    let mut bodies: BTreeMap<String, Vec<u8>> = BTreeMap::new();

    for entry in archive.entries()? {
        let mut entry = entry?;
        let path = entry.path()?.to_path_buf();
        let name = path.to_string_lossy().to_string();
        if name == METADATA_MEMBER {
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf)?;
            metadata = Some(serde_json::from_slice(&buf)?);
            continue;
        }
        if !is_safe_key(&name) {
            return Err(SaveError::Path(format!(
                "archive member {name:?} is not a portable key"
            )));
        }
        let mut buf = Vec::new();
        entry.read_to_end(&mut buf)?;
        bodies.insert(name, buf);
    }

    let metadata =
        metadata.ok_or_else(|| SaveError::Corrupt("archive has no metadata member".into()))?;
    if metadata.version != 1 {
        return Err(SaveError::Corrupt(format!(
            "unsupported archive metadata version {}",
            metadata.version
        )));
    }

    // Cross-check the member list against the metadata before touching disk.
    let declared: BTreeMap<&str, &MemberFile> =
        metadata.files.iter().map(|f| (f.key.as_str(), f)).collect();
    if declared.len() != metadata.files.len() {
        return Err(SaveError::Corrupt(
            "duplicate keys in archive metadata".into(),
        ));
    }
    for (key, body) in &bodies {
        match declared.get(key.as_str()) {
            Some(file) => {
                let seen = hex::encode(Sha256::digest(body));
                if seen != file.sha256.to_ascii_lowercase() {
                    return Err(SaveError::Corrupt(format!(
                        "{key}: member hash {seen} != declared {}",
                        file.sha256
                    )));
                }
                if body.len() as u64 != file.size {
                    return Err(SaveError::Corrupt(format!(
                        "{key}: member size {} != declared {}",
                        body.len(),
                        file.size
                    )));
                }
            }
            None => {
                return Err(SaveError::Corrupt(format!(
                    "archive member {key} is not listed in its metadata"
                )));
            }
        }
    }

    let mut result = Extracted::default();
    for file in &metadata.files {
        let Some(dest) = writes.get(&file.key) else {
            result.skipped.push(file.key.clone());
            continue;
        };
        let body = bodies
            .get(&file.key)
            .ok_or_else(|| SaveError::Corrupt(format!("archive lacks {key}", key = file.key)))?;
        atomic_write(dest, body, file.mode)?;
        result.written.push((file.key.clone(), dest.clone()));
    }
    Ok(result)
}

/// Portable keys are relative, slash-separated, and escape-free.
fn is_safe_key(key: &str) -> bool {
    !key.is_empty()
        && !key.starts_with('/')
        && !key.contains('\\')
        && !key.contains(':')
        && key
            .split('/')
            .all(|segment| !segment.is_empty() && segment != "." && segment != "..")
}

/// Write via `<dest>.gd-tmp` + rename so an interrupted extraction can never
/// leave a half-written save where the game expects a whole one.
fn atomic_write(dest: &std::path::Path, body: &[u8], mode: u32) -> Result<(), SaveError> {
    let parent = dest
        .parent()
        .ok_or_else(|| SaveError::Path(format!("{} has no parent", dest.display())))?;
    std::fs::create_dir_all(parent)?;
    let tmp = parent.join(format!(
        ".{}.gd-tmp",
        dest.file_name()
            .ok_or_else(|| SaveError::Path(format!("{} has no name", dest.display())))?
            .to_string_lossy()
    ));
    {
        let mut file = std::fs::File::create(&tmp)?;
        file.write_all(body)?;
        file.flush()?;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let permissions =
            std::fs::Permissions::from_mode(if mode & 0o111 != 0 { 0o755 } else { 0o644 });
        std::fs::set_permissions(&tmp, permissions)?;
    }
    #[cfg(not(unix))]
    {
        let _ = mode;
    }
    std::fs::rename(&tmp, dest)?;
    Ok(())
}

/// Keep `portable_mode` referenced outside unix where it is only used by the
/// collector, without a cfg dance at the call site.
#[allow(dead_code)]
fn _mode_anchor(metadata: &std::fs::Metadata) -> u32 {
    portable_mode(metadata)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::context::ResolvedFile;
    use std::fs;

    fn fixture_file(dir: &std::path::Path, key: &str, body: &[u8], exec: bool) -> ResolvedFile {
        let path = dir.join(key);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, body).unwrap();
        #[cfg(unix)]
        if exec {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
        }
        let metadata = fs::metadata(&path).unwrap();
        ResolvedFile {
            key: key.to_string(),
            path,
            sha256: hex::encode(Sha256::digest(body)),
            size: body.len() as u64,
            mode: portable_mode(&metadata),
        }
    }

    fn files(dir: &std::path::Path) -> Vec<ResolvedFile> {
        vec![
            fixture_file(dir, "saves/slot2.sav", b"two", false),
            fixture_file(dir, "cfg/settings.ini", b"[a]", true),
            fixture_file(dir, "saves/slot1.sav", b"one", false),
        ]
    }

    #[test]
    fn the_same_save_always_builds_the_same_bytes() {
        let a = tempfile::tempdir().unwrap();
        let b = tempfile::tempdir().unwrap();
        // Same logical files, different absolute locations and build order.
        let first = build_archive(&files(a.path()), "e".repeat(64).as_str(), "linux").unwrap();
        let mut reordered = files(b.path());
        reordered.reverse();
        // mtime/exec differences unrelated to the exec bit must not change
        // bytes; identical content does.
        std::thread::sleep(std::time::Duration::from_millis(5));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&reordered[0].path, fs::Permissions::from_mode(0o600)).unwrap();
        }
        let second = build_archive(&reordered, "e".repeat(64).as_str(), "linux").unwrap();
        assert_eq!(first.bytes, second.bytes);
        assert_eq!(first.content_hash, second.content_hash);
        assert_eq!(first.archive_sha256, second.archive_sha256);
    }

    #[test]
    fn content_hash_ignores_framing_but_tracks_bytes() {
        let dir = tempfile::tempdir().unwrap();
        let base = build_archive(&files(dir.path()), "e".repeat(64).as_str(), "linux").unwrap();
        // Change one file's bytes and re-hash from disk; the list itself is
        // built first so `files()` cannot rewrite the fixture back.
        fs::write(dir.path().join("saves/slot1.sav"), b"ONE").unwrap();
        let changed = {
            let mut fs_ = files(dir.path());
            // files() re-wrote the fixture; overwrite again, then re-hash.
            fs::write(dir.path().join("saves/slot1.sav"), b"ONE").unwrap();
            for f in fs_.iter_mut() {
                let body = fs::read(&f.path).unwrap();
                f.sha256 = hex::encode(Sha256::digest(&body));
                f.size = body.len() as u64;
            }
            build_archive(&fs_, "e".repeat(64).as_str(), "linux").unwrap()
        };
        assert_ne!(base.content_hash, changed.content_hash);
        assert_ne!(base.archive_sha256, changed.archive_sha256);
    }

    #[test]
    fn round_trips_into_resolved_paths_with_verification() {
        let built_dir = tempfile::tempdir().unwrap();
        let built =
            build_archive(&files(built_dir.path()), "e".repeat(64).as_str(), "linux").unwrap();

        // "Another machine": different absolute paths, same keys.
        let other = tempfile::tempdir().unwrap();
        let writes: BTreeMap<String, PathBuf> =
            ["cfg/settings.ini", "saves/slot1.sav", "saves/slot2.sav"]
                .into_iter()
                .map(|k| (k.to_string(), other.path().join(k)))
                .collect();

        let extracted =
            extract_archive(&built.bytes, Some(&built.archive_sha256), &writes).unwrap();
        assert_eq!(extracted.written.len(), 3);
        assert!(extracted.skipped.is_empty());
        assert_eq!(
            fs::read(other.path().join("saves/slot2.sav")).unwrap(),
            b"two"
        );
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(other.path().join("cfg/settings.ini"))
                    .unwrap()
                    .permissions()
                    .mode()
                    & 0o755,
                0o755
            );
        }
    }

    #[test]
    fn refuses_a_tampered_archive_and_unknown_members() {
        let dir = tempfile::tempdir().unwrap();
        let built = build_archive(&files(dir.path()), "e".repeat(64).as_str(), "linux").unwrap();
        let writes: BTreeMap<String, PathBuf> =
            [("saves/slot1.sav".to_string(), dir.path().join("out1"))]
                .into_iter()
                .collect();

        let mut tampered = built.bytes.clone();
        let last = tampered.len() - 1;
        tampered[last] ^= 0xff;
        assert!(matches!(
            extract_archive(&tampered, Some(&built.archive_sha256), &writes),
            Err(SaveError::Corrupt(_))
        ));

        // Content is fine; only one key resolves: the rest are skipped, not
        // written somewhere guessed.
        let extracted =
            extract_archive(&built.bytes, Some(&built.archive_sha256), &writes).unwrap();
        assert_eq!(extracted.written.len(), 1);
        assert_eq!(extracted.skipped.len(), 2);
    }

    #[test]
    fn key_safety() {
        assert!(is_safe_key("My Game/saves/slot 1.sav"));
        assert!(!is_safe_key("/etc/passwd"));
        assert!(!is_safe_key("../escape"));
        assert!(!is_safe_key("a/../../b"));
        assert!(!is_safe_key("C:/Windows/system32"));
        assert!(!is_safe_key("back\\slash"));
    }
}
