use std::{
    fs::{metadata, read_dir},
    path::{Path, PathBuf},
};

use anyhow::Result;

use crate::versions::{
    archive_backend::ZipVersionBackend, path_backend::PathVersionBackend, types::VersionBackend,
};

pub mod archive_backend;
pub mod path_backend;

pub fn _list_files(vec: &mut Vec<PathBuf>, path: &Path) -> Result<()> {
    if metadata(path)?.is_dir() {
        let paths = read_dir(path)?;
        for path_result in paths {
            let full_path = path_result?.path();
            if metadata(&full_path)?.is_dir() {
                _list_files(vec, &full_path)?;
            } else {
                vec.push(full_path);
            }
        }
    };

    Ok(())
}

const SUPPORTED_FILE_EXTENSIONS: [&str; 11] = [
    "tar", "pax", "cpio", "zip", "jar", "ar", "xar", "rar", "rpm", "7z", "iso",
];

pub mod types;
#[allow(clippy::type_complexity)]
pub fn create_backend_constructor<'a>(
    path: &Path,
) -> Option<Box<dyn FnOnce() -> Result<Box<dyn VersionBackend + Send + Sync + 'a>>>> {
    if !path.exists() {
        return None;
    }

    let is_directory = path.is_dir();
    if is_directory {
        let base_dir = path.to_path_buf();
        return Some(Box::new(move || {
            Ok(Box::new(PathVersionBackend { base_dir }))
        }));
    };

    let file_extension = path.extension().and_then(|v| v.to_str())?;

    if SUPPORTED_FILE_EXTENSIONS.contains(&file_extension) {
        let buf = path.to_path_buf();
        return Some(Box::new(move || Ok(Box::new(ZipVersionBackend::new(buf)?))));
    }

    None
}
