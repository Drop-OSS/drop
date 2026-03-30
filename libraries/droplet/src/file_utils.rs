use std::{
    fs::{self, metadata},
    path::{Path, PathBuf},
};

fn list_files_recursive(vec: &mut Vec<PathBuf>, path: &Path) {
    if metadata(path).unwrap().is_dir() {
        let paths = fs::read_dir(path).unwrap();
        for path_result in paths {
            let full_path = path_result.unwrap().path();
            if metadata(&full_path).unwrap().is_dir() {
                list_files_recursive(vec, &full_path);
            } else {
                vec.push(full_path);
            }
        }
    }
}

pub fn list_files(path: &Path) -> Vec<PathBuf> {
    let mut vec = Vec::new();
    list_files_recursive(&mut vec, path);
    vec
}
