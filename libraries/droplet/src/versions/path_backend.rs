#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::{io::SeekFrom, path::PathBuf};

use anyhow::anyhow;
use async_trait::async_trait;
use tokio::{
    fs::File,
    io::{AsyncReadExt as _, AsyncSeekExt as _},
};

#[derive(Clone)]
pub struct PathVersionBackend {
    pub base_dir: PathBuf,
}

use crate::versions::{
    _list_files,
    types::{MinimumFileObject, VersionBackend, VersionFile},
};

#[async_trait]
impl VersionBackend for PathVersionBackend {
    async fn list_files(&self) -> anyhow::Result<Vec<VersionFile>> {
        let mut vec = Vec::new();
        _list_files(&mut vec, &self.base_dir)?;

        let mut results = Vec::new();

        for pathbuf in vec.iter() {
            let relative = pathbuf.strip_prefix(self.base_dir.clone())?;

            results.push(
                self.peek_file(
                    relative
                        .to_str()
                        .ok_or(anyhow!(
                            "Could not parse path: {}",
                            relative.to_string_lossy()
                        ))?
                        .to_owned(),
                )
                .await?,
            );
        }

        Ok(results)
    }

    async fn reader(
        &self,
        file: &VersionFile,
        start: u64,
        end: u64,
    ) -> anyhow::Result<Box<dyn MinimumFileObject>> {
        let mut file = File::open(self.base_dir.join(file.relative_filename.clone())).await?;

        if start != 0 {
            file.seek(SeekFrom::Start(start)).await?;
        }

        if end != 0 {
            return Ok(Box::new(file.take(end - start)));
        }

        Ok(Box::new(file))
    }

    async fn peek_file(&self, sub_path: String) -> anyhow::Result<VersionFile> {
        let pathbuf = self.base_dir.join(sub_path.clone());
        if !pathbuf.exists() {
            return Err(anyhow!("Path doesn't exist: {}", pathbuf.to_string_lossy()));
        };

        let file = File::open(pathbuf.clone()).await?;
        let metadata = file.try_clone().await?.metadata().await?;
        let permission_object = metadata.permissions();
        let permissions = {
            let perm: u32;
            #[cfg(target_family = "unix")]
            {
                perm = permission_object.mode();
            }
            #[cfg(not(target_family = "unix"))]
            {
                perm = 0
            }
            perm
        };

        Ok(VersionFile {
            relative_filename: sub_path,
            permission: permissions,
            size: metadata.len(),
        })
    }

    fn require_whole_files(&self) -> bool {
        false
    }
}
