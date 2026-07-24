// Linux-only file

use std::{
    fs::{DirEntry, read_dir, read_to_string},
    io,
    path::PathBuf,
    sync::LazyLock,
};

use database::{borrow_db_checked, borrow_db_mut_checked};
use log::warn;
use serde::Serialize;

static SEARCH_PATHS: LazyLock<Vec<String>> = LazyLock::new(|| {
    let mut paths = vec!["/usr/share/steam/compatibilitytools.d/".to_owned()];

    if let Some(home_dir) = std::env::home_dir() {
        paths.push(
            home_dir
                .join(".steam/root/compatibilitytools.d/")
                .to_string_lossy()
                .to_string(),
        );
    }

    paths
});

pub fn read_proton_path(proton_path: PathBuf) -> Result<Option<ProtonPath>, io::Error> {
    let read_dir = read_dir(&proton_path)?.flatten().collect::<Vec<DirEntry>>();
    let has_proton_path = read_dir
        .iter()
        .find(|v| v.file_name().to_string_lossy() == "proton")
        .is_some();
    if !has_proton_path {
        return Ok(None);
    };

    let compat_vdf = read_dir
        .iter()
        .find(|v| v.file_name().to_string_lossy() == "compatibilitytool.vdf");

    let compat_vdf = match compat_vdf {
        Some(v) => v,
        None => return Ok(None),
    };

    let compat_vdf = read_to_string(compat_vdf.path())?;
    let compat_vdf = keyvalues_parser::parse(&compat_vdf)
        .inspect_err(|err| warn!("failed to parse vdf: {:?}", err))
        .map_err(|err| io::Error::other(err.to_string()))?;

    // Function was made with a lot of trial and error
    // Not intended to be readable
    let get_display_name = || -> Option<String> {
        let compat_tools = compat_vdf.value.unwrap_obj();
        let compat_tools = compat_tools.values().next()?.iter().next()?;
        let compat_tools = compat_tools.get_obj().unwrap();
        let compat_tools = compat_tools.values().next()?.iter().next()?.get_obj()?;
        let display_name = compat_tools.get("display_name")?.iter().next()?.get_str()?;
        Some(display_name.to_string())
    };

    if let Some(display_name) = get_display_name() {
        return Ok(Some(ProtonPath {
            path: proton_path.to_string_lossy().to_string(),
            name: display_name,
        }));
    }

    Ok(None)
}

pub fn discover_proton_paths() -> Result<Vec<ProtonPath>, io::Error> {
    let mut results = Vec::new();

    for search_path in &*SEARCH_PATHS {
        if let Ok(potential_dirs) = read_dir(search_path) {
            for proton_path in potential_dirs {
                if let Some(proton) = read_proton_path(proton_path?.path())? {
                    results.push(proton);
                }
            }
        }
    }

    Ok(results)
}

#[derive(Serialize)]
pub struct ProtonPath {
    pub path: String,
    pub name: String,
}

#[derive(Serialize)]
pub struct ProtonPaths {
    pub autodiscovered: Vec<ProtonPath>,
    pub custom: Vec<ProtonPath>,
    pub default: Option<String>,
}

#[tauri::command]
pub async fn fetch_proton_paths() -> Result<ProtonPaths, String> {
    let autodiscovered = discover_proton_paths().map_err(|v| v.to_string())?;

    let db_lock = borrow_db_checked();

    let custom = db_lock
        .applications
        .additional_proton_paths
        .iter()
        .flat_map(|v| read_proton_path(PathBuf::from(v)))
        .flatten()
        .collect::<Vec<ProtonPath>>();

    let default = db_lock.applications.default_proton_path.clone();

    Ok(ProtonPaths {
        autodiscovered,
        custom,
        default,
    })
}

#[tauri::command]
pub fn add_proton_layer(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    let proton_layer = read_proton_path(path)
        .map_err(|err| err.to_string())?
        .ok_or("Unable to detect Proton at selected path.".to_owned())?;

    let mut db = borrow_db_mut_checked();
    db.applications
        .additional_proton_paths
        .push(proton_layer.path);

    Ok(())
}

#[tauri::command]
pub async fn remove_proton_layer(index: usize) {
    let mut db = borrow_db_mut_checked();
    let deleted = db.applications.additional_proton_paths.try_remove(index);
    if let Some(deleted) = deleted
        && let Some(default_path) = &db.applications.default_proton_path
        && *default_path == deleted
    {
        db.applications.default_proton_path = None;
    }
}

#[tauri::command]
pub async fn set_default(path: String) -> Result<(), String> {
    let proton_paths = fetch_proton_paths().await?;

    let valid = proton_paths
        .autodiscovered
        .iter()
        .find(|v| v.path == path)
        .or(proton_paths.custom.iter().find(|v| v.path == path))
        .is_some();

    if !valid {
        return Err("Invalid default Proton path.".to_string());
    }

    let mut db_lock = borrow_db_mut_checked();
    db_lock.applications.default_proton_path = Some(path);

    Ok(())
}
