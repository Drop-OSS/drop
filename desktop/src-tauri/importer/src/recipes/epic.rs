//! Epic Games Launcher: which folders the launcher installed games into.
//!
//! Epic is the one storefront that records each install exactly: every game
//! gets a JSON `.item` file in `ProgramData/Epic/EpicGamesLauncher/Data/
//! Manifests/` carrying its `InstallLocation`, its app id, and the
//! `LaunchExecutable` Epic itself would start. The folder list and the entry
//! point therefore need no guessing - which is also why this recipe overrides
//! the heuristic executable with Epic's own answer when it has one.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use super::{
    DetectedInstall, WindowsFs, collect_installs, find_game_executable, resolve_windows_path,
};

pub const LAUNCHER: &str = "epic";

/// Where Epic keeps game folders when a manifest is unreadable or missing.
const CONVENTIONAL_ROOTS: [&str; 1] = ["Program Files/Epic Games"];

/// Installs the Epic launcher recorded or left behind.
pub fn detect(fs: &WindowsFs, seen: &mut BTreeSet<PathBuf>, out: &mut Vec<DetectedInstall>) {
    let system = fs.system_drive();
    if !system.is_dir() {
        return;
    }

    let manifests = system
        .join("ProgramData")
        .join("Epic")
        .join("EpicGamesLauncher")
        .join("Data")
        .join("Manifests");
    if let Ok(entries) = std::fs::read_dir(&manifests) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("item") {
                continue;
            }
            if let Some(install) = manifest_install(&path, fs)
                && seen.insert(install.folder.clone())
            {
                out.push(install);
            }
        }
    }

    for name in CONVENTIONAL_ROOTS {
        collect_installs(LAUNCHER, &system.join(name), fs, seen, out);
    }
}

/// One `.item` manifest as an install: folder, Epic's app id as the install
/// key, and the executable Epic would launch - falling back to the shared
/// heuristic when the manifest stays silent.
fn manifest_install(manifest: &Path, fs: &WindowsFs) -> Option<DetectedInstall> {
    let text = std::fs::read_to_string(manifest).ok()?;
    let json: serde_json::Value = serde_json::from_str(&text).ok()?;

    let app_name = json.get("AppName").and_then(|v| v.as_str()).unwrap_or("");
    // Epic's own package and the engine runtimes share the manifests folder;
    // neither is a game.
    if app_name.is_empty()
        || app_name.eq_ignore_ascii_case("EpicGamesLauncher")
        || app_name.starts_with("UE_")
    {
        return None;
    }
    let folder = resolve_windows_path(json.get("InstallLocation").and_then(|v| v.as_str())?, fs)?;
    if !folder.is_dir() {
        return None;
    }

    let recorded = json
        .get("LaunchExecutable")
        .and_then(|v| v.as_str())
        .filter(|exe| !exe.is_empty())
        .map(|exe| exe.replace('\\', "/"));
    let executable = recorded
        .filter(|exe| folder.join(exe).is_file())
        .or_else(|| find_game_executable(&folder));

    // Epic frequently installs into a folder named after the raw app id, so
    // the folder name is only the fallback: the manifest's own DisplayName
    // is the human title Epic shows in its launcher.
    let display_name = json
        .get("DisplayName")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|name| !name.is_empty());
    let title = display_name.map(str::to_string).or_else(|| {
        folder
            .file_name()
            .and_then(|n| n.to_str())
            .map(str::to_string)
    })?;

    Some(DetectedInstall {
        launcher: LAUNCHER,
        title,
        install_key: Some(app_name.to_string()),
        executable,
        folder,
        prefix: fs.prefix(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("gd-importer-epic-{}-{name}", std::process::id()))
    }

    #[test]
    fn manifests_give_folders_app_ids_and_the_recorded_executable() {
        let prefix = temp("manifests");
        let _ = std::fs::remove_dir_all(&prefix);
        let drive_c = prefix.join("drive_c");
        let manifests = drive_c.join("ProgramData/Epic/EpicGamesLauncher/Data/Manifests");
        std::fs::create_dir_all(&manifests).unwrap();
        std::fs::write(
            manifests.join("catalog-fortnite.item"),
            r#"{"AppName":"Fortnite","LaunchExecutable":"FortniteGame\\Binaries\\Win64\\FortniteClient.exe","InstallLocation":"C:\\Games\\Epic\\Fortnite"}"#,
        )
        .unwrap();
        std::fs::write(
            manifests.join("catalog-launcher.item"),
            r#"{"AppName":"EpicGamesLauncher","InstallLocation":"C:\\Program Files\\Epic Games\\Launcher"}"#,
        )
        .unwrap();
        let game = drive_c.join("Games/Epic/Fortnite/FortniteGame/Binaries/Win64");
        std::fs::create_dir_all(&game).unwrap();
        std::fs::write(game.join("FortniteClient.exe"), b"MZ").unwrap();
        // The launcher's own folder exists; its manifest must still not list
        // it as a game.
        std::fs::create_dir_all(drive_c.join("Program Files/Epic Games/Launcher")).unwrap();
        std::fs::write(
            drive_c.join("Program Files/Epic Games/Launcher/UnrealEngineLauncher.exe"),
            b"MZ",
        )
        .unwrap();

        let fs = WindowsFs::Prefix(prefix.clone());
        let mut seen = BTreeSet::new();
        let mut out = Vec::new();
        detect(&fs, &mut seen, &mut out);

        assert_eq!(out.len(), 1, "only the game: {out:?}");
        assert_eq!(out[0].title, "Fortnite");
        assert_eq!(out[0].install_key.as_deref(), Some("Fortnite"));
        assert_eq!(
            out[0].executable.as_deref(),
            Some("FortniteGame/Binaries/Win64/FortniteClient.exe"),
            "Epic's recorded executable wins over the heuristic, slashes and all"
        );
        std::fs::remove_dir_all(&prefix).ok();
    }

    #[test]
    fn conventional_root_still_searched_for_unrecorded_folders() {
        let prefix = temp("roots");
        let _ = std::fs::remove_dir_all(&prefix);
        let game = prefix.join("drive_c/Program Files/Epic Games/Death Stranding");
        std::fs::create_dir_all(&game).unwrap();
        std::fs::write(game.join("DeathStranding.exe"), b"MZ").unwrap();

        let fs = WindowsFs::Prefix(prefix.clone());
        let mut seen = BTreeSet::new();
        let mut out = Vec::new();
        detect(&fs, &mut seen, &mut out);

        assert_eq!(
            out.len(),
            1,
            "the folder without a manifest is found: {out:?}"
        );
        assert_eq!(out[0].title, "Death Stranding");
        assert_eq!(out[0].install_key, None);
        std::fs::remove_dir_all(&prefix).ok();
    }

    #[test]
    fn display_name_beats_a_hash_named_folder() {
        let prefix = temp("displayname");
        let _ = std::fs::remove_dir_all(&prefix);
        let drive_c = prefix.join("drive_c");
        let manifests = drive_c.join("ProgramData/Epic/EpicGamesLauncher/Data/Manifests");
        std::fs::create_dir_all(&manifests).unwrap();
        // The real-world shape: install folder named after the raw app id,
        // the human name only in the manifest.
        std::fs::write(
            manifests.join("catalog-stranding.item"),
            r#"{"AppName":"7ce1367f0ee846418b236dfe96d30c2c","DisplayName":"Death Stranding","InstallLocation":"C:\\Games\\Epic\\7ce1367f0ee846418b236dfe96d30c2c"}"#,
        )
        .unwrap();
        let game = drive_c.join("Games/Epic/7ce1367f0ee846418b236dfe96d30c2c");
        std::fs::create_dir_all(&game).unwrap();
        std::fs::write(game.join("DeathStranding.exe"), b"MZ").unwrap();

        let fs = WindowsFs::Prefix(prefix.clone());
        let mut seen = BTreeSet::new();
        let mut out = Vec::new();
        detect(&fs, &mut seen, &mut out);

        assert_eq!(out.len(), 1, "{out:?}");
        assert_eq!(out[0].title, "Death Stranding", "never the hash");
        assert_eq!(
            out[0].install_key.as_deref(),
            Some("7ce1367f0ee846418b236dfe96d30c2c"),
            "the app id stays the install key"
        );
        std::fs::remove_dir_all(&prefix).ok();
    }
}
