use std::fmt;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

static TMP_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Debug)]
pub enum PathGuardError {
    UnsafePath(String),
    Io(io::Error),
}

impl fmt::Display for PathGuardError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PathGuardError::UnsafePath(msg) => write!(f, "unsafe path: {msg}"),
            PathGuardError::Io(err) => write!(f, "{err}"),
        }
    }
}

impl std::error::Error for PathGuardError {}

impl From<io::Error> for PathGuardError {
    fn from(err: io::Error) -> Self {
        PathGuardError::Io(err)
    }
}

fn unsafe_path(detail: impl Into<String>) -> PathGuardError {
    PathGuardError::UnsafePath(detail.into())
}

/// Whether `path` currently exists and is a symlink (does not follow it).
pub fn is_symlink(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .map(|meta| meta.file_type().is_symlink())
        .unwrap_or(false)
}

fn canonical_root(root: &Path) -> Result<PathBuf, PathGuardError> {
    fs::canonicalize(root).map_err(|e| {
        unsafe_path(format!(
            "cannot resolve install directory {}: {e}",
            root.display()
        ))
    })
}

/// Resolve `candidate` (relative to `root`) while rejecting absolute paths,
/// `..`/prefix components, and any existing symlinked component.
pub fn safe_join(root: &Path, candidate: impl AsRef<Path>) -> Result<PathBuf, PathGuardError> {
    let root = canonical_root(root)?;
    let candidate = candidate.as_ref();
    let mut current = root.clone();
    for component in candidate.components() {
        match component {
            Component::Normal(segment) => {
                current.push(segment);
                if is_symlink(&current) {
                    return Err(unsafe_path(format!(
                        "refusing to follow symlink {}",
                        current.display()
                    )));
                }
            }
            Component::CurDir => {}
            Component::ParentDir => {
                return Err(unsafe_path(format!(
                    "path '{}' must not contain '..'",
                    candidate.display()
                )));
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(unsafe_path(format!(
                    "path '{}' must be relative to the install directory",
                    candidate.display()
                )));
            }
        }
    }
    Ok(current)
}

/// Create `candidate` as a directory (and parents) inside `root`, rejecting
/// symlinked components. Returns the created path.
pub fn ensure_dir(root: &Path, candidate: impl AsRef<Path>) -> Result<PathBuf, PathGuardError> {
    let dir = safe_join(root, candidate)?;
    fs::create_dir_all(&dir)?;
    if is_symlink(&dir) {
        return Err(unsafe_path(format!(
            "refusing to use symlinked directory {}",
            dir.display()
        )));
    }
    Ok(dir)
}

fn temp_path_for(target: &Path) -> Result<PathBuf, PathGuardError> {
    let parent = target
        .parent()
        .ok_or_else(|| unsafe_path(format!("path {} has no parent", target.display())))?;
    let counter = TMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let stem = target
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("payload");
    Ok(parent.join(format!(".{stem}.drop-tmp-{}-{counter}", std::process::id())))
}

/// Write to a temp file in the destination's directory, then atomically rename
/// it over the destination so an existing symlink is replaced, not followed.
fn atomic_replace<F>(target: &Path, fill: F) -> Result<(), PathGuardError>
where
    F: FnOnce(&mut File) -> Result<(), PathGuardError>,
{
    let parent = target
        .parent()
        .ok_or_else(|| unsafe_path(format!("path {} has no parent", target.display())))?;
    // safe_join already rejected symlinked components; create_dir_all only
    // creates the (nonexistent) tail.
    fs::create_dir_all(parent)?;
    let tmp = temp_path_for(target)?;

    let filled = (|| -> Result<(), PathGuardError> {
        let mut file = OpenOptions::new().write(true).create_new(true).open(&tmp)?;
        fill(&mut file)?;
        file.sync_all()?;
        Ok(())
    })();

    if let Err(err) = filled {
        let _ = fs::remove_file(&tmp);
        return Err(err);
    }

    #[cfg(windows)]
    {
        if target.exists() {
            fs::remove_file(target)?;
        }
    }

    fs::rename(&tmp, target).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        PathGuardError::Io(e)
    })
}

/// Write `bytes` to `candidate` inside `root` without following symlinks.
pub fn write_file(
    root: &Path,
    candidate: impl AsRef<Path>,
    bytes: &[u8],
) -> Result<(), PathGuardError> {
    let target = safe_join(root, candidate)?;
    atomic_replace(&target, |file| {
        file.write_all(bytes)?;
        Ok(())
    })
}

/// Copy `src` (a trusted local path) to `candidate` inside `root` without
/// following symlinks at the destination.
pub fn copy_to(root: &Path, src: &Path, candidate: impl AsRef<Path>) -> Result<(), PathGuardError> {
    let target = safe_join(root, candidate)?;
    atomic_replace(&target, |file| {
        let mut reader = File::open(src)?;
        std::io::copy(&mut reader, file)?;
        Ok(())
    })
}

/// Normalize `.`/`..` components without touching the filesystem. Used only as
/// a fallback for dangling symlinks, whose target cannot be canonicalized.
fn lexical_normalize(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if !out.pop() {
                    out.push(component.as_os_str());
                }
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// Whether the symlink at `path` resolves outside `canonical_root`.
///
/// Existing targets are fully resolved with `fs::canonicalize`; dangling links
/// fall back to lexical resolution of `parent + target` so a link cannot escape
/// simply because its target does not exist yet.
fn symlink_escapes(canonical_root: &Path, path: &Path) -> bool {
    let Ok(target) = fs::read_link(path) else {
        return false;
    };
    let resolved = fs::canonicalize(path).unwrap_or_else(|_| {
        let joined = if target.is_absolute() {
            target
        } else {
            path.parent().unwrap_or(canonical_root).join(target)
        };
        lexical_normalize(&joined)
    });
    !resolved.starts_with(canonical_root)
}

/// Remove symlinks under `scan_dir` whose resolved target escapes `root`.
///
/// External extractors (7-Zip, innoextract) write archives directly and can
/// materialize symlink entries that [`safe_join`] never sees because Drop did
/// not create them. Links that resolve inside `root` are legitimate (Linux
/// releases ship relative links between game files) and are kept; escaping
/// links are unlinked and returned so the caller can fail the step.
pub fn remove_escaping_symlinks(
    root: &Path,
    scan_dir: &Path,
) -> Result<Vec<PathBuf>, PathGuardError> {
    let canonical_root = canonical_root(root)?;
    let canonical_scan = fs::canonicalize(scan_dir)?;
    if !canonical_scan.starts_with(&canonical_root) {
        return Err(unsafe_path(format!(
            "scan directory {} is outside {}",
            canonical_scan.display(),
            canonical_root.display()
        )));
    }

    let mut removed = Vec::new();
    for entry in walkdir::WalkDir::new(&canonical_scan)
        .min_depth(1)
        .follow_links(false)
    {
        let entry = entry.map_err(|e| PathGuardError::Io(io::Error::other(e)))?;
        if !entry.file_type().is_symlink() {
            continue;
        }
        if symlink_escapes(&canonical_root, entry.path()) {
            fs::remove_file(entry.path())?;
            removed.push(entry.path().to_path_buf());
        }
    }
    Ok(removed)
}

/// Remove a regular file (or symlink, which is unlinked, never followed) under
/// `root`. Missing paths are a no-op.
pub fn remove_file(root: &Path, candidate: impl AsRef<Path>) -> Result<(), PathGuardError> {
    let path = safe_join(root, candidate)?;
    match fs::symlink_metadata(&path) {
        Ok(meta) if meta.is_dir() && !meta.file_type().is_symlink() => Err(unsafe_path(format!(
            "refusing to remove directory {} as a file",
            path.display()
        ))),
        Ok(_) => {
            fs::remove_file(&path)?;
            Ok(())
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(PathGuardError::Io(e)),
    }
}

/// Recursively remove a directory under `root`. A symlink is unlinked rather
/// than traversed. Missing paths are a no-op.
pub fn remove_dir_all(root: &Path, candidate: impl AsRef<Path>) -> Result<(), PathGuardError> {
    let path = safe_join(root, candidate)?;
    match fs::symlink_metadata(&path) {
        Ok(meta) if meta.file_type().is_symlink() => {
            fs::remove_file(&path)?;
            Ok(())
        }
        Ok(meta) if meta.is_dir() => {
            fs::remove_dir_all(&path)?;
            Ok(())
        }
        Ok(_) => {
            fs::remove_file(&path)?;
            Ok(())
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(PathGuardError::Io(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    fn symlink_dir(src: &Path, dst: &Path) {
        std::os::unix::fs::symlink(src, dst).unwrap();
    }

    #[test]
    fn rejects_parent_dir_and_absolute_paths() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(safe_join(tmp.path(), "a/b").is_ok());
        assert!(safe_join(tmp.path(), "../escape").is_err());
        assert!(safe_join(tmp.path(), "a/../../escape").is_err());
        assert!(safe_join(tmp.path(), "/etc/passwd").is_err());
    }

    #[test]
    fn write_file_publishes_atomically() {
        let tmp = tempfile::tempdir().unwrap();
        write_file(tmp.path(), "sub/out.txt", b"hello").unwrap();
        assert_eq!(fs::read(tmp.path().join("sub/out.txt")).unwrap(), b"hello");
    }

    #[cfg(unix)]
    #[test]
    fn refuses_to_write_through_symlinked_destination() {
        let tmp = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let victim = outside.path().join("victim.txt");
        fs::write(&victim, b"original").unwrap();
        symlink_dir(&victim, &tmp.path().join("game.txt"));

        assert!(write_file(tmp.path(), "game.txt", b"pwned").is_err());
        assert_eq!(fs::read(&victim).unwrap(), b"original");
    }

    #[cfg(unix)]
    #[test]
    fn refuses_to_write_through_symlinked_directory() {
        let tmp = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        symlink_dir(outside.path(), &tmp.path().join("linkdir"));

        assert!(write_file(tmp.path(), "linkdir/file.txt", b"pwned").is_err());
        assert!(!outside.path().join("file.txt").exists());
    }

    #[cfg(unix)]
    #[test]
    fn removes_escaping_symlinks_and_keeps_internal_ones() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().join("game");
        let outside = tempfile::tempdir().unwrap();
        fs::create_dir_all(root.join("sub")).unwrap();
        fs::write(root.join("sub/keep.txt"), b"data").unwrap();

        let internal = root.join("internal-link");
        symlink_dir(&root.join("sub"), &internal);
        let escaping = root.join("escaping-link");
        symlink_dir(outside.path(), &escaping);

        let removed = remove_escaping_symlinks(&root, &root).unwrap();

        assert_eq!(removed, vec![escaping.clone()]);
        assert!(is_symlink(&internal));
        assert!(!is_symlink(&escaping));
        assert!(outside.path().exists());
        assert_eq!(fs::read(root.join("sub/keep.txt")).unwrap(), b"data");
    }

    #[cfg(unix)]
    #[test]
    fn removes_dangling_escaping_symlinks() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().join("game");
        fs::create_dir_all(&root).unwrap();

        let dangling = root.join("dangling-link");
        std::os::unix::fs::symlink("../outside-missing/target", &dangling).unwrap();

        let removed = remove_escaping_symlinks(&root, &root).unwrap();

        assert_eq!(removed, vec![dangling.clone()]);
        assert!(!is_symlink(&dangling));
    }

    #[cfg(unix)]
    #[test]
    fn removes_symlink_chains_that_escape() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().join("game");
        let outside = tempfile::tempdir().unwrap();
        fs::create_dir_all(&root).unwrap();

        let hop = root.join("hop");
        symlink_dir(outside.path(), &hop);
        let chain = root.join("chain");
        std::os::unix::fs::symlink("hop", &chain).unwrap();

        let removed = remove_escaping_symlinks(&root, &root).unwrap();

        assert_eq!(removed.len(), 2);
        assert!(!is_symlink(&hop));
        assert!(!is_symlink(&chain));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_scan_directories_outside_the_root() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().join("game");
        let outside = tmp.path().join("outside");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();

        assert!(remove_escaping_symlinks(&root, &outside).is_err());
    }
}
