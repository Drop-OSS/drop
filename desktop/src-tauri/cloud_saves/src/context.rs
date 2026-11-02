//! Resolving manifest templates to concrete files on this machine, and
//! assigning each file its portable archive key.
//!
//! The execution environment decides everything:
//!
//! - native Linux game: `<xdgData>`/`<xdgConfig>`/`<home>` resolve against
//!   the real XDG directories; Windows placeholders do not apply and the
//!   entries using them are skipped;
//! - Windows game under a Proton prefix (the Steam Deck case): every Windows
//!   placeholder resolves *inside* the prefix (`<winAppData>` becomes
//!   `<pfx>/drive_c/users/<wine user>/AppData/Roaming`, ...), so a save
//!   travels between a Windows box and a Deck as the same logical file;
//! - the portable key is the template tail after the last placeholder
//!   (`<winDocuments>/My Game/saves/slot.sav` -> `My Game/saves/slot.sav`),
//!   which is why the content hash matches across machines; a `*` segment
//!   contributes the concrete matched name instead.
//!
//! `<root>` is the game's install directory, `<game>` the manifest's first
//! `installDir` tail (empty when the manifest lists none), `<base>` their
//! join. `<skip>` drops the entry. `<storeUserId>` needs a store identity the
//! desktop does not track yet, so entries using it are skipped with a warning
//! until v1.x.

use std::{
    collections::BTreeMap,
    fs,
    io::{self, Read},
    path::{Path, PathBuf},
};

use database::platform::Platform;
use sha2::{Digest, Sha256};

use crate::canonical::ContentFile;
use crate::error::SaveError;
use crate::manifest::{ManifestFile, SaveManifest, TargetOs};
use crate::path::CommonPath;
use crate::placeholder;

/// One save file as it exists on this machine, hashed and keyed.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ResolvedFile {
    pub key: String,
    pub path: PathBuf,
    pub sha256: String,
    pub size: u64,
    /// Portable mode: 0o755 when the execute bit is set, else 0.
    pub mode: u32,
}

impl ResolvedFile {
    pub fn content_file(&self) -> ContentFile {
        ContentFile {
            key: self.key.clone(),
            size: self.size,
            sha256: self.sha256.clone(),
            mode: self.mode,
        }
    }
}

#[derive(Clone, Debug)]
pub struct ResolutionContext {
    pub host: Platform,
    /// The platform the *game* targets (a Windows game under Proton is
    /// `Windows` even though the host is Linux).
    pub target: Platform,
    pub install_dir: PathBuf,
    /// Wine/Proton prefix root, when the game runs through one.
    pub prefix: Option<PathBuf>,
    /// The user directory inside the prefix (`drive_c/users/<name>`).
    pub wine_user: Option<String>,
    /// First `installDir` tail from the manifest, applied to `<game>`/`<base>`.
    pub game_dir: Option<String>,

    /// Manifests may reference a store account id; v1 has none.
    pub store_user_id: Option<String>,
}

impl ResolutionContext {
    pub fn new(host: Platform, target: Platform, install_dir: PathBuf) -> ResolutionContext {
        ResolutionContext {
            host,
            target,
            install_dir,
            prefix: None,
            wine_user: None,
            game_dir: None,
            store_user_id: None,
        }
    }

    /// Attach a Proton prefix, resolving its user directory. A missing prefix
    /// means the game never ran yet: files will simply not exist, which is a
    /// normal "fresh device" state, not an error.
    pub fn with_prefix(mut self, prefix: PathBuf) -> ResolutionContext {
        self.wine_user = wine_user(&prefix);
        self.prefix = Some(prefix);
        self
    }

    pub fn environment(&self) -> TargetOs {
        TargetOs::effective(self.host, self.target)
    }

    /// Where the manifest's `installDir` tail points, when there is one.
    fn base_dir(&self) -> PathBuf {
        match &self.game_dir {
            Some(tail) => self.install_dir.join(tail),
            None => self.install_dir.clone(),
        }
    }

    fn prefix_c(&self) -> Option<PathBuf> {
        self.prefix.as_ref().map(|p| p.join("drive_c"))
    }

    fn prefix_users_home(&self) -> Option<PathBuf> {
        let user = self.wine_user.as_deref()?;
        Some(self.prefix_c()?.join("users").join(user))
    }

    /// Resolve one placeholder component to a concrete directory, or `None`
    /// when it does not apply to this environment (the entry is then skipped).
    fn translate(&self, name: &str) -> Option<PathBuf> {
        let prefix_c = self.prefix_c();
        let users_home = self.prefix_users_home();
        let in_prefix = prefix_c.is_some();

        match name {
            placeholder::ROOT => return Some(self.install_dir.clone()),
            placeholder::GAME => {
                return Some(match &self.game_dir {
                    Some(tail) => PathBuf::from(tail),
                    None => PathBuf::new(),
                });
            }
            placeholder::BASE => return Some(self.base_dir()),
            placeholder::STORE_USER_ID => return self.store_user_id.as_ref().map(PathBuf::from),
            placeholder::HOME => {
                return match (in_prefix, users_home) {
                    (true, Some(home)) => Some(home),
                    _ => CommonPath::Home.get(),
                };
            }
            placeholder::OS_USER_NAME => {
                return Some(match (&self.wine_user, in_prefix) {
                    (Some(user), true) => PathBuf::from(user.as_str()),
                    _ => PathBuf::from(whoami::username()),
                });
            }
            placeholder::XDG_DATA if self.environment() == TargetOs::Linux => {
                return CommonPath::Data.get();
            }
            placeholder::XDG_CONFIG if self.environment() == TargetOs::Linux => {
                return CommonPath::Config.get();
            }
            _ => {}
        }

        // Everything below is a Windows placeholder: it needs a Windows
        // environment, and resolves inside the prefix when there is one.
        // On a native Windows host the placeholders are the host's own known
        // folders; other hosts have no Windows folders to resolve to.
        if self.environment() != TargetOs::Windows {
            return None;
        }
        // `in_prefix` is the path computed for the prefix world; it is only
        // consulted when a prefix actually exists, so its being `None` for a
        // Windows-host call never matters.
        let win_path =
            |in_prefix: Option<PathBuf>, on_host: fn() -> Option<PathBuf>| -> Option<PathBuf> {
                if prefix_c.is_some() {
                    in_prefix
                } else if self.host == Platform::Windows {
                    on_host()
                } else {
                    None
                }
            };
        let under_users = |tail: &str| users_home.as_ref().map(|h| h.join(tail));
        let under_c = |tail: &str| prefix_c.as_ref().map(|c| c.join(tail));

        match name {
            placeholder::WIN_APP_DATA => {
                win_path(under_users("AppData/Roaming"), || CommonPath::Config.get())
            }
            placeholder::WIN_LOCAL_APP_DATA => {
                win_path(under_users("AppData/Local"), || CommonPath::DataLocal.get())
            }
            placeholder::WIN_LOCAL_APP_DATA_LOW => {
                win_path(under_users("AppData/LocalLow"), || {
                    CommonPath::DataLocalLow.get()
                })
            }
            placeholder::WIN_DOCUMENTS => {
                win_path(under_users("Documents"), || CommonPath::Document.get())
            }
            placeholder::WIN_PUBLIC => {
                win_path(under_c("users/Public"), || CommonPath::Public.get())
            }
            placeholder::WIN_PROGRAM_DATA => win_path(under_c("ProgramData"), || {
                Some(PathBuf::from("C:/ProgramData"))
            }),
            placeholder::WIN_DIR => {
                win_path(under_c("windows"), || Some(PathBuf::from("C:/Windows")))
            }
            _ => None,
        }
    }
}

/// The user folder Wine created inside a fresh prefix (`drive_c/users/<name>`
/// minus `Public`); `user` is Wine's historical default when the prefix has
/// not been created yet or has more than one candidate.
fn wine_user(prefix: &Path) -> Option<String> {
    let users = prefix.join("drive_c/users");
    let mut candidates: Vec<String> = fs::read_dir(&users)
        .map(|entries| {
            entries
                .filter_map(|entry| entry.ok())
                .filter(|entry| entry.path().is_dir())
                .filter_map(|entry| entry.file_name().into_string().ok())
                .filter(|name| !name.eq_ignore_ascii_case("public") && !name.starts_with('.'))
                .collect()
        })
        .unwrap_or_default();
    candidates.sort();
    // A prefix without (or with several) user folders: Wine's historical
    // default. Never None - a missing folder means the game never ran, and
    // resolution should still speak about a concrete (empty) location.
    Some(candidates.pop().unwrap_or_else(|| "user".to_string()))
}

/// A save resolved on this machine: the files that exist (hashed, keyed) and
/// every location the manifest points at ("sites"), whether or not something
/// is there yet. Sites are what make a pull onto a fresh device work: an
/// archive key for a file that has never existed here still knows where it
/// belongs.
pub struct ResolvedSave {
    pub files: Vec<ResolvedFile>,
    pub sites: Vec<(String, PathBuf)>,
}

/// Resolve every applicable manifest entry and hash what exists.
///
/// Returns files sorted and keyed; duplicate keys covering different content
/// is a manifest bug and fails closed.
pub fn collect_files(
    context: &ResolutionContext,
    manifest: &SaveManifest,
) -> Result<Vec<ResolvedFile>, SaveError> {
    Ok(resolve_manifest(context, manifest)?.files)
}

pub fn resolve_manifest(
    context: &ResolutionContext,
    manifest: &SaveManifest,
) -> Result<ResolvedSave, SaveError> {
    let mut by_key: BTreeMap<String, ResolvedFile> = BTreeMap::new();
    let mut sites: Vec<(String, PathBuf)> = Vec::new();

    for entry in manifest.applicable(context.environment()) {
        if entry.template.contains(placeholder::SKIP) {
            continue;
        }
        for (path, key) in expand(context, entry) {
            match fs::metadata(&path) {
                Err(_) => {
                    // Does not exist yet - normal: a fresh device, or the
                    // game simply never wrote this file.
                    sites.push((key, path));
                }
                Ok(metadata) if metadata.is_dir() => {
                    sites.push((key.clone(), path.clone()));
                    for file in walk(&path)? {
                        let relative = file
                            .strip_prefix(&path)
                            .map_err(|_| {
                                SaveError::Path(format!(
                                    "{} escapes {}",
                                    file.display(),
                                    path.display()
                                ))
                            })?
                            .to_string_lossy()
                            .replace('\\', "/");
                        let file_key = join_key(&key, &relative);
                        sites.push((file_key.clone(), file.clone()));
                        insert(&mut by_key, hash_file(file_key, file)?)?;
                    }
                }
                Ok(metadata) if metadata.is_file() => {
                    sites.push((key.clone(), path.clone()));
                    insert(&mut by_key, hash_file(key, path)?)?;
                }
                Ok(_) => {} // fifos, sockets, devices: not saves
            }
        }
    }

    sites.sort();
    sites.dedup();
    Ok(ResolvedSave {
        files: by_key.into_values().collect(),
        sites,
    })
}

/// Map archive keys onto this machine's paths.
///
/// An exact site match wins; otherwise the longest site that is a `/`-boundary
/// prefix of the key (a directory location) hosts the remainder. Keys nothing
/// resolves to are *skipped*, never written somewhere guessed.
pub fn write_targets(
    sites: &[(String, PathBuf)],
    keys: &[String],
) -> (BTreeMap<String, PathBuf>, Vec<String>) {
    let mut exact: BTreeMap<&str, &PathBuf> = BTreeMap::new();
    for (key, path) in sites {
        exact.entry(key.as_str()).or_insert(path);
    }
    let mut written = BTreeMap::new();
    let mut skipped = Vec::new();
    for key in keys {
        if let Some(path) = exact.get(key.as_str()) {
            written.insert(key.clone(), (*path).clone());
            continue;
        }
        let mut best: Option<(&str, &PathBuf)> = None;
        for (site_key, site_path) in sites {
            let prefix = format!("{site_key}/");
            let better = match best {
                None => true,
                Some((b, _)) => site_key.len() > b.len(),
            };
            if key.starts_with(&prefix) && better {
                best = Some((site_key.as_str(), site_path));
            }
        }
        match best {
            Some((site_key, site_path)) => {
                written.insert(key.clone(), site_path.join(&key[site_key.len() + 1..]));
            }
            None => skipped.push(key.clone()),
        }
    }
    (written, skipped)
}

fn insert(
    by_key: &mut BTreeMap<String, ResolvedFile>,
    file: ResolvedFile,
) -> Result<(), SaveError> {
    if let Some(existing) = by_key.get(&file.key)
        && existing.sha256 != file.sha256
    {
        return Err(SaveError::Path(format!(
            "manifest collision: key {} resolves to different files ({} vs {})",
            file.key,
            existing.path.display(),
            file.path.display()
        )));
    }
    by_key.insert(file.key.clone(), file);
    Ok(())
}

fn join_key(prefix: &str, tail: &str) -> String {
    if prefix.is_empty() {
        tail.to_string()
    } else if tail.is_empty() {
        prefix.to_string()
    } else {
        format!("{prefix}/{tail}")
    }
}

/// One step of template expansion: a concrete path plus the key text
/// accumulated since the last placeholder.
#[derive(Clone)]
struct Step {
    path: PathBuf,
    key: String,
}

/// Walk a template, returning each (concrete path, portable key) it matches.
///
/// Keys restart after the last placeholder (server contract), so the key
/// accumulator resets on every placeholder component; literal and glob-matched
/// segments append their concrete names.
fn expand(context: &ResolutionContext, entry: &ManifestFile) -> Vec<(PathBuf, String)> {
    let mut steps = vec![Step {
        path: PathBuf::new(),
        key: String::new(),
    }];

    for component in entry.template.split('/').filter(|c| !c.is_empty()) {
        let mut next: Vec<Step> = Vec::new();
        if let Some(name) = placeholder_name(component) {
            match context.translate(name) {
                Some(resolved) => {
                    for step in steps {
                        next.push(Step {
                            path: step.path.join(resolved.clone()),
                            // The portable key restarts after the placeholder.
                            key: String::new(),
                        });
                    }
                }
                None => {
                    log::debug!(
                        "save entry {} does not apply here (placeholder {name})",
                        entry.template
                    );
                    return Vec::new();
                }
            }
        } else if component.contains(['*', '?']) {
            for step in steps {
                for matched in glob_segment(&step.path, component) {
                    next.push(Step {
                        key: join_key(&step.key, &matched),
                        path: step.path.join(&matched),
                    });
                }
            }
        } else {
            for step in steps {
                next.push(Step {
                    path: step.path.join(component),
                    key: join_key(&step.key, component),
                });
            }
        }
        steps = next;
    }

    steps
        .into_iter()
        .map(|step| (step.path, step.key))
        .collect()
}

/// A component that is exactly one known placeholder.
fn placeholder_name(component: &str) -> Option<&'static str> {
    placeholder::ALL
        .iter()
        .chain([placeholder::WIN_LOCAL_APP_DATA_LOW, placeholder::SKIP].iter())
        .copied()
        .find(|known| *known == component)
}

/// Match one path segment containing `*` globs (v1: at most one star per
/// segment, which covers `save*.dat`, `*`, `Slot *`).
fn glob_segment(dir: &Path, pattern: &str) -> Vec<String> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut matched: Vec<String> = entries
        .filter_map(|e| e.ok())
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|name| match_glob(pattern, name))
        .collect();
    matched.sort();
    matched
}

fn match_glob(pattern: &str, name: &str) -> bool {
    match pattern.split_once('*') {
        Some((prefix, suffix)) => {
            name.starts_with(prefix)
                && name.ends_with(suffix)
                && name.len() >= prefix.len() + suffix.len()
        }
        None => {
            pattern == name
                || (pattern.contains('?') && pattern.len() == name.len() && {
                    pattern
                        .chars()
                        .zip(name.chars())
                        .all(|(p, n)| p == '?' || p == n)
                })
        }
    }
}

/// Recursive walk collecting regular files, sorted, symlinks skipped.
fn walk(dir: &Path) -> io::Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            files.extend(walk(&entry.path())?);
        } else if file_type.is_file() {
            files.push(entry.path());
        }
    }
    files.sort();
    Ok(files)
}

fn hash_file(key: String, path: PathBuf) -> Result<ResolvedFile, SaveError> {
    let metadata = fs::metadata(&path)?;
    let mut file = fs::File::open(&path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    let mode = portable_mode(&metadata);
    Ok(ResolvedFile {
        key,
        sha256: hex::encode(hasher.finalize()),
        size: metadata.len(),
        path,
        mode,
    })
}

/// Portable mode for the content hash and the archive header: the execute bit
/// is the only portable semantic (Windows/Proton have no unix modes that
/// survive a trip through a prefix), so mode is 0o755 or 0.
pub fn portable_mode(metadata: &fs::Metadata) -> u32 {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if metadata.permissions().mode() & 0o111 != 0 {
            0o755
        } else {
            0
        }
    }
    #[cfg(not(unix))]
    {
        let _ = metadata;
        0
    }
}

/// The archive key of a template: everything after the last placeholder.
/// The same rule the resolver's key accumulator uses, exposed for callers
/// that want the manifest tail without resolving.
pub fn template_key(template: &str) -> String {
    let components: Vec<&str> = template.split('/').filter(|c| !c.is_empty()).collect();
    let last_placeholder = components
        .iter()
        .rposition(|c| placeholder_name(c).is_some());
    let tail = match last_placeholder {
        Some(index) => &components[(index + 1).min(components.len())..],
        None => components.as_slice(),
    };
    tail.join("/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manifest::ManifestResponse;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

    fn fixture() -> (tempfile::TempDir, PathBuf, PathBuf) {
        let root = tempfile::tempdir().unwrap();
        let install = root.path().join("games/My Game");
        let prefix = root.path().join("pfx");
        fs::create_dir_all(&install).unwrap();
        (root, install, prefix)
    }

    fn parse_json(entry: serde_json::Value) -> SaveManifest {
        SaveManifest::from_response(&ManifestResponse {
            game_id: "g".into(),
            entry,
            source: "curated".into(),
            ludusavi_name: None,
            entry_hash: "e".repeat(64),
        })
        .unwrap()
    }

    #[test]
    fn native_template_resolves_and_keys_after_placeholder() {
        let (_keep, install, _prefix) = fixture();
        let data = install.join("saves");
        fs::create_dir_all(&data).unwrap();
        fs::write(data.join("slot1.sav"), b"one").unwrap();

        let context = ResolutionContext::new(Platform::Linux, Platform::Linux, install);
        let manifest = parse_json(serde_json::json!({
            "files": { "<base>/saves/slot1.sav": { "tags": ["save"] } },
        }));
        let files = collect_files(&context, &manifest).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].key, "saves/slot1.sav");
        assert_eq!(files[0].size, 3);
        assert_eq!(files[0].mode, 0);
    }

    #[test]
    fn proton_prefix_placeholders_resolve_inside_the_prefix() {
        let (_keep, install, prefix) = fixture();
        let docs = prefix.join("drive_c/users/wineuser/Documents/My Game/saves");
        fs::create_dir_all(&docs).unwrap();
        fs::write(docs.join("save.dat"), b"deck").unwrap();

        let context =
            ResolutionContext::new(Platform::Linux, Platform::Windows, install).with_prefix(prefix);
        assert_eq!(context.wine_user.as_deref(), Some("wineuser"));

        let manifest = parse_json(serde_json::json!({
            "files": { "<winDocuments>/My Game/saves": { "condition": "os: win" } },
        }));
        let files = collect_files(&context, &manifest).unwrap();
        assert_eq!(files.len(), 1);
        // The key is the template tail, never the machine-specific prefix.
        assert_eq!(files[0].key, "My Game/saves/save.dat");
    }

    #[test]
    fn windows_entries_are_skipped_for_a_native_linux_game() {
        let (_keep, install, _prefix) = fixture();
        let context = ResolutionContext::new(Platform::Linux, Platform::Linux, install);
        let manifest = parse_json(serde_json::json!({
            "files": { "<winAppData>/My Game": { "condition": "os: win" } },
        }));
        assert!(collect_files(&context, &manifest).unwrap().is_empty());
    }

    #[test]
    fn wildcard_segments_expand_into_concrete_keys() {
        let (_keep, install, _prefix) = fixture();
        let dir = install.join("saves");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("slot2.sav"), b"b").unwrap();
        fs::write(dir.join("slot1.sav"), b"a").unwrap();
        fs::write(dir.join("notes.txt"), b"skip me").unwrap();

        let context = ResolutionContext::new(Platform::Linux, Platform::Linux, install);
        let manifest = parse_json(serde_json::json!({
            "files": { "<base>/saves/slot*.sav": {} },
        }));
        let files = collect_files(&context, &manifest).unwrap();
        let keys: Vec<&str> = files.iter().map(|f| f.key.as_str()).collect();
        assert_eq!(keys, vec!["saves/slot1.sav", "saves/slot2.sav"]); // sorted, txt excluded
    }

    #[test]
    fn exec_bit_survives_as_the_only_mode() {
        let (_keep, install, _prefix) = fixture();
        let path = install.join("weird-exec.save");
        fs::write(&path, b"x").unwrap();
        #[cfg(unix)]
        fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();

        let context = ResolutionContext::new(Platform::Linux, Platform::Linux, install);
        let manifest = parse_json(serde_json::json!({ "files": { "<base>/weird-exec.save": {} } }));
        let files = collect_files(&context, &manifest).unwrap();
        assert_eq!(files[0].mode, 0o755);
    }

    #[test]
    fn template_key_rule() {
        assert_eq!(
            template_key("<winDocuments>/My Game/saves/slot.sav"),
            "My Game/saves/slot.sav"
        );
        assert_eq!(template_key("<base>/Foo/bar"), "Foo/bar");
    }

    #[test]
    fn wine_user_falls_back_to_default_without_a_prefix() {
        let (_keep, install, prefix) = fixture();
        fs::create_dir_all(&prefix).unwrap();
        let context =
            ResolutionContext::new(Platform::Linux, Platform::Windows, install).with_prefix(prefix);
        assert_eq!(context.wine_user.as_deref(), Some("user"));
    }
}
