// Epic's install records follow the depot copy: the Heroic/Lutris pattern.
//
// An Epic build's bootstrapper (and any Epic-aware tool reading a prefix -
// including Drop's own detection recipe) looks for a JSON `.item` file under
// `ProgramData/Epic/EpicGamesLauncher/Data/Manifests/` naming the app id and
// the `InstallLocation` Epic itself would honour. A depot-installed Epic copy
// has no such record - it arrived from the CAS, not from the launcher - so
// some launches die in the bootstrapper looking for themselves.
//
// Seeding the game's own umu prefix with the record the launcher would have
// written (plus the small Data layout around it) is what Heroic and Lutris
// have done for sideloads for years: a symlink from the conventional
// `Program Files/Epic Games/<folder>` into the real install directory makes
// the Windows path inside the prefix resolve to content that lives anywhere
// on the Linux filesystem, and the `.item` names that path. The depot copy
// stays one copy; the record is a pointer, not a second install.
//
// Unix-only: on Windows the real Epic launcher reads the real ProgramData,
// and writing a depot copy into the system's launcher records would be
// tampering with someone else's storefront.
#![cfg(unix)]

use std::io;
use std::path::{Path, PathBuf};

use database::db::DATA_ROOT_DIR;

/// Drop's catalog id for an Epic-sourced release is `epic-<appid>`; the app
/// id is what Epic's own records key on.
pub fn epic_app_id(game_id: &str) -> Option<&str> {
    game_id.strip_prefix("epic-").filter(|s| !s.is_empty())
}

/// Seed the Epic install record for a finished depot install, if the release
/// is Epic-sourced at all. Never fatal: a missing record is the state every
/// install was in before this existed, so a refusal here only ever logs.
pub fn seed_epic_install(
    game_id: &str,
    install_dir: &str,
    build_version: Option<&str>,
) -> io::Result<()> {
    let Some(app_id) = epic_app_id(game_id) else {
        return Ok(());
    };
    // The same prefix the launch handlers hand to umu as WINEPREFIX.
    let prefix = DATA_ROOT_DIR.join("pfx").join(game_id);
    seed_item_file(app_id, build_version, &prefix, Path::new(install_dir))?;
    Ok(())
}

/// Write the `.item` manifest, the launcher's Data layout around it, and the
/// conventional-folder symlink that makes `InstallLocation` mean the install
/// directory. Returns the manifest path. Public because the storefront-
/// prefix handoff seeds the same shape into a different prefix.
pub fn seed_item_file(
    app_id: &str,
    build_version: Option<&str>,
    prefix: &Path,
    install_dir: &Path,
) -> io::Result<PathBuf> {
    let slug = install_dir
        .file_name()
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "install folder has no name to record",
            )
        })?
        .to_string_lossy()
        .to_string();

    // The layout Epic writes for itself; tools that read it expect the
    // directories to exist, not merely the manifest.
    let data = prefix
        .join("drive_c")
        .join("ProgramData")
        .join("Epic")
        .join("EpicGamesLauncher")
        .join("Data");
    for dir in ["Manifests", "Downloads", "Storage"] {
        std::fs::create_dir_all(data.join(dir))?;
    }

    // The conventional location inside the prefix, and the link that points
    // it at wherever the content actually is. A stale link from an earlier
    // install describes the wrong folder, so it gets replaced; a real,
    // non-empty directory is left alone - that is somebody else's content.
    let windows_location = format!("C:\\Program Files\\Epic Games\\{slug}");
    let link = prefix
        .join("drive_c")
        .join("Program Files")
        .join("Epic Games")
        .join(&slug);
    if let Some(parent) = link.parent() {
        std::fs::create_dir_all(parent)?;
    }
    if std::fs::read_link(&link).ok().as_deref() != Some(install_dir) {
        match std::fs::remove_file(&link).or_else(|e| {
            if e.kind() == io::ErrorKind::NotFound {
                Err(e)
            } else {
                std::fs::remove_dir(&link)
            }
        }) {
            Ok(()) => {}
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(e),
        }
        std::os::unix::fs::symlink(install_dir, &link)?;
    }

    let mut record = serde_json::json!({
        "CatalogNamespace": "ue4",
        "AppName": app_id,
        "DisplayName": slug,
        "InstallLocation": windows_location,
        "InstallDirectory": slug,
        "MajorVersion": 0,
        "MinorVersion": 0,
        "PatchVersion": 0,
    });
    if let Some(build) = build_version {
        record["BuildVersion"] = serde_json::Value::String(build.to_string());
    }
    let item_path = data.join("Manifests").join(format!("{app_id}.item"));
    std::fs::write(&item_path, serde_json::to_vec_pretty(&record)?)?;
    Ok(item_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("gd-epic-seed-{name}-{}", std::process::id()))
    }

    #[test]
    fn catalog_ids_carry_the_app_id_and_nothing_else_does() {
        assert_eq!(epic_app_id("epic-fg3th4h"), Some("fg3th4h"));
        assert_eq!(epic_app_id("gog-123"), None);
        assert_eq!(epic_app_id("epic-"), None);
    }

    #[test]
    fn a_seed_writes_the_record_the_launcher_would_have_written() {
        let prefix = temp("layout");
        let install = temp("layout-game").join("Death Stranding");
        let _ = std::fs::remove_dir_all(&prefix);
        let _ = std::fs::remove_dir_all(temp("layout-game"));
        std::fs::create_dir_all(&install).unwrap();

        let item = seed_item_file("fg3th4h", Some("12345"), &prefix, &install).unwrap();
        assert_eq!(item.file_name().unwrap(), "fg3th4h.item");

        let record: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&item).unwrap()).unwrap();
        assert_eq!(record["AppName"], "fg3th4h");
        assert_eq!(record["BuildVersion"], "12345");
        assert_eq!(
            record["InstallLocation"],
            r"C:\Program Files\Epic Games\Death Stranding"
        );

        // The Windows path resolves through the prefix to the real folder.
        let link = prefix.join("drive_c/Program Files/Epic Games/Death Stranding");
        assert_eq!(std::fs::read_link(&link).unwrap(), install);
        for dir in ["Manifests", "Downloads", "Storage"] {
            assert!(
                prefix
                    .join("drive_c/ProgramData/Epic/EpicGamesLauncher/Data")
                    .join(dir)
                    .is_dir(),
                "the {dir} directory is part of the layout"
            );
        }
    }

    #[test]
    fn reseeding_is_idempotent_and_a_moved_install_relinks() {
        let prefix = temp("relink");
        let parent_a = temp("relink-a");
        let parent_b = temp("relink-b");
        let _ = std::fs::remove_dir_all(&prefix);
        let _ = std::fs::remove_dir_all(&parent_a);
        let _ = std::fs::remove_dir_all(&parent_b);
        let first = parent_a.join("Game");
        let second = parent_b.join("Game");
        std::fs::create_dir_all(&first).unwrap();
        std::fs::create_dir_all(&second).unwrap();

        seed_item_file("app", None, &prefix, &first).unwrap();
        seed_item_file("app", None, &prefix, &first).unwrap();
        assert_eq!(
            std::fs::read_link(prefix.join("drive_c/Program Files/Epic Games/Game")).unwrap(),
            first
        );

        // Same folder name in a new place: the record keeps its location and
        // the link follows the content.
        seed_item_file("app", None, &prefix, &second).unwrap();
        assert_eq!(
            std::fs::read_link(prefix.join("drive_c/Program Files/Epic Games/Game")).unwrap(),
            second
        );
    }

    #[test]
    fn a_real_directory_in_the_way_is_left_alone() {
        let prefix = temp("occupied");
        let install = temp("occupied-game").join("Game");
        let _ = std::fs::remove_dir_all(&prefix);
        let _ = std::fs::remove_dir_all(temp("occupied-game"));
        std::fs::create_dir_all(&install).unwrap();
        let resident = prefix.join("drive_c/Program Files/Epic Games/Game");
        std::fs::create_dir_all(resident.join("keepme")).unwrap();

        assert!(seed_item_file("app", None, &prefix, &install).is_err());
        assert!(resident.join("keepme").is_dir());
    }
}
