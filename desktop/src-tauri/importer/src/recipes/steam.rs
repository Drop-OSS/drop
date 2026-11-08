//! Steam: which libraries the client keeps games in.
//!
//! Steam records its own answer: `steamapps/libraryfolders.vdf` in the
//! install lists every library folder the account has added, one per disk,
//! in Valve's KeyValue format - a flat `"key" "value"` file with doubled
//! backslashes in the values. Each library holds its games under
//! `steamapps/common`, one folder per title, which is the shape
//! [`collect_installs`] wants.
//!
//! The install path itself used to live only in the registry; the modern
//! client writes it into the same VDF (`"path"` at the top of the file for
//! the primary library), so a fresh install of Steam into a prefix is found
//! with no native call at all. A Steam whose primary library is on a drive
//! this prefix cannot see is, like any other missing drive, simply not
//! searched.

use std::collections::{BTreeSet, HashMap};
use std::path::{Path, PathBuf};

use super::{WindowsFs, collect_installs, resolve_windows_path};

pub const LAUNCHER: &str = "steam";

/// Where the Windows client installs itself when nobody moves it.
const CONVENTIONAL_ROOTS: [&str; 2] = ["Program Files (x86)/Steam", "Program Files/Steam"];

/// Installs the Steam client's libraries hold.
pub fn detect(fs: &WindowsFs, seen: &mut BTreeSet<PathBuf>, out: &mut Vec<super::DetectedInstall>) {
    let system = fs.system_drive();
    if !system.is_dir() {
        return;
    }

    let mut roots: BTreeSet<PathBuf> = BTreeSet::new();

    // Every library folder the VDF names, primary or added later.
    for steam_root in steam_installs(fs) {
        let vdf = steam_root.join("steamapps").join("libraryfolders.vdf");
        for value in vdf_paths_in(&vdf) {
            let Some(library) = resolve_windows_path(&value, fs) else {
                continue;
            };
            let common = library.join("steamapps").join("common");
            if common.is_dir() {
                roots.insert(common);
            }
        }
        // The install itself is a library whether or not it wrote a VDF:
        // a default Steam's games live directly under its own steamapps.
        let own = steam_root.join("steamapps").join("common");
        if own.is_dir() {
            roots.insert(own);
        }
    }

    for root in roots {
        let before = out.len();
        collect_installs(LAUNCHER, &root, fs, seen, out);
        // Each library's `steamapps` also holds one `appmanifest_<appid>.acf`
        // per installed game, and its `installdir` is exactly the folder
        // name under `common`. The app id is what a Steam client handoff
        // (`steam://run/<appid>`) launches by, so an install carries it.
        if let Some(steamapps) = root.parent() {
            let apps = acf_appids(steamapps);
            for install in &mut out[before..] {
                install.install_key = apps.get(&install.title).cloned();
            }
        }
    }
}

/// The library's `installdir -> appid` map, read one file at a time.
///
/// An `.acf` is the same KeyValue shape as the library VDF - quoted pairs,
/// backslashes doubled - and describes exactly one game, so the first
/// `appid` and first `installdir` are the answer and nothing else is asked.
fn acf_appids(steamapps: &Path) -> HashMap<String, String> {
    let Ok(entries) = std::fs::read_dir(steamapps) else {
        return HashMap::new();
    };
    let mut apps = HashMap::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if !name.starts_with("appmanifest_") || !name.ends_with(".acf") {
            continue;
        }
        let Ok(text) = std::fs::read_to_string(&path) else {
            continue;
        };
        // Values are unquoted here after the pair split, backslashes un-doubled.
        let value_of = |key: &str| {
            text.lines().find_map(|line| {
                let rest = line.trim().strip_prefix(key)?.trim().strip_prefix('"')?;
                let value = rest.split('"').next().unwrap_or_default();
                (!value.is_empty()).then(|| value.replace("\\\\", "\\"))
            })
        };
        if let (Some(appid), Some(installdir)) = (value_of("\"appid\""), value_of("\"installdir\""))
        {
            apps.insert(installdir, appid);
        }
    }
    apps
}

/// The Steam installations on this Windows filesystem: the conventional
/// locations, checked for the marker every real install has.
fn steam_installs(fs: &WindowsFs) -> Vec<PathBuf> {
    CONVENTIONAL_ROOTS
        .iter()
        .map(|name| fs.system_drive().join(name))
        // A folder named "Steam" that never held the client (a game someone
        // named after it) has no steamapps and no executable to run.
        .filter(|root| root.join("steamapps").is_dir() || root.join("steam.exe").is_file())
        .collect()
}

/// Every `"path"` value in a libraryfolders VDF.
///
/// The KeyValue format quotes both sides of every pair and escapes a
/// backslash as `\\`, so `"C:\\SteamLibrary"` is really `C:\SteamLibrary`.
/// Only lines shaped like a path pair are taken; nested keys of other names
/// are the library's own bookkeeping (labels, sizes, an app list) and none
/// of it is a folder.
fn vdf_paths_in(vdf: &Path) -> Vec<String> {
    let Ok(text) = std::fs::read_to_string(vdf) else {
        return Vec::new();
    };
    text.lines()
        .filter_map(|line| {
            let line = line.trim();
            let rest = line.strip_prefix("\"path\"")?;
            let (_, value) = rest.trim().split_once('"')?;
            let value = value.split('"').next().unwrap_or_default();
            let value = value.replace("\\\\", "\\");
            (!value.is_empty()).then_some(value)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("gd-importer-steam-{}-{name}", std::process::id()))
    }

    #[test]
    fn vdf_paths_unescape_and_reach_their_common_dirs() {
        let prefix = temp("vdf");
        let _ = std::fs::remove_dir_all(&prefix);
        let steam = prefix.join("drive_c/Program Files (x86)/Steam");
        std::fs::create_dir_all(steam.join("steamapps/common")).unwrap();
        std::fs::write(steam.join("steam.exe"), b"MZ").unwrap();
        // A second library on another drive, in the client's own spelling,
        // plus a library that is the primary itself (its games already found
        // through the install root - dedupe is the `seen` set's job).
        std::fs::write(
            steam.join("steamapps/libraryfolders.vdf"),
            "\
\"libraryfolders\"
{
\t\"0\"
\t{
\t\t\"path\"\t\t\"C:\\\\Program Files (x86)\\\\Steam\"
\t\t\"label\"\t\t\"\"
\t}
\t\"1\"
\t{
\t\t\"path\"\t\t\"C:\\\\Second\\\\SteamLibrary\"
\t\t\"apps\"\t\t{ \"220\" \"1362\" }
\t}
}
",
        )
        .unwrap();

        let second = prefix.join("drive_c/Second/SteamLibrary/steamapps/common/Half-Life 2");
        std::fs::create_dir_all(&second).unwrap();
        std::fs::write(second.join("hl2.exe"), b"MZ").unwrap();
        let primary = steam.join("steamapps/common/Portal 2");
        std::fs::create_dir_all(&primary).unwrap();
        std::fs::write(primary.join("portal2.exe"), b"MZ").unwrap();
        // A steamapps folder of its own is not a game library.
        std::fs::create_dir_all(steam.join("steamapps/shadercache")).unwrap();
        // The client's own install records, one per game, naming the app id
        // the folder answers to. Portal 2 has one; Half-Life 2's library
        // keeps its own manifest beside its own common dir.
        std::fs::write(
            steam.join("steamapps/appmanifest_620.acf"),
            "\"AppInstallState\"\n{\n\t\"appid\"\t\t\"620\"\n\t\"installdir\"\t\t\"Portal 2\"\n}\n",
        )
        .unwrap();
        std::fs::write(
            prefix.join("drive_c/Second/SteamLibrary/steamapps/appmanifest_220.acf"),
            "\"AppInstallState\"\n{\n\t\"appid\"\t\t\"220\"\n\t\"installdir\"\t\t\"Half-Life 2\"\n}\n",
        )
        .unwrap();

        let fs = WindowsFs::Prefix(prefix.clone());
        let mut seen = BTreeSet::new();
        let mut out = Vec::new();
        detect(&fs, &mut seen, &mut out);

        let titles: Vec<&str> = out.iter().map(|i| i.title.as_str()).collect();
        assert!(
            titles.contains(&"Half-Life 2") && titles.contains(&"Portal 2"),
            "both libraries are searched: {titles:?}"
        );
        assert!(
            !titles.contains(&"shadercache"),
            "steamapps internals are not games: {titles:?}"
        );
        assert!(out.iter().all(|i| i.launcher == LAUNCHER));
        let keys: HashMap<_, _> = out
            .iter()
            .map(|i| (i.title.as_str(), i.install_key.as_deref()))
            .collect();
        assert_eq!(keys.get("Portal 2").copied(), Some(Some("620")));
        assert_eq!(keys.get("Half-Life 2").copied(), Some(Some("220")));
        std::fs::remove_dir_all(&prefix).ok();
    }

    #[test]
    fn a_folder_named_steam_that_never_held_the_client_is_skipped() {
        let prefix = temp("impostor");
        let _ = std::fs::remove_dir_all(&prefix);
        let not_steam = prefix.join("drive_c/Program Files (x86)/Steam");
        std::fs::create_dir_all(not_steam.join("some game")).unwrap();
        std::fs::write(not_steam.join("some game/game.exe"), b"MZ").unwrap();

        let fs = WindowsFs::Prefix(prefix.clone());
        let mut seen = BTreeSet::new();
        let mut out = Vec::new();
        detect(&fs, &mut seen, &mut out);

        assert!(out.is_empty(), "no steamapps, no steam.exe: {out:?}");
        std::fs::remove_dir_all(&prefix).ok();
    }
}
