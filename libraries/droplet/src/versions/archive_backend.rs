use std::{path::PathBuf, task::Poll};

use anyhow::anyhow;
use async_trait::async_trait;
use libarchive_drop::{
    archive::{Entry, FileType, ReadCompression, ReadFormat},
    reader::{Builder, FileReader, Reader},
};
use tokio::io::AsyncRead;

use crate::versions::types::{MinimumFileObject, VersionBackend, VersionFile};

pub struct ZipVersionBackend {
    path: PathBuf,
}
impl ZipVersionBackend {
    pub fn new(path: PathBuf) -> anyhow::Result<Self> {
        Ok(Self { path })
    }

    fn open_archive(&self) -> Result<FileReader, anyhow::Error> {
        let mut archive = Builder::new();
        archive.support_format(ReadFormat::All)?;
        archive.support_compression(ReadCompression::All)?;
        let archive = archive.open_file(&self.path)?;

        Ok(archive)
    }
}

struct ArchiveReader<'a> {
    archive: FileReader,
    prev_block: Option<&'a [u8]>,
}

impl<'a> AsyncRead for ArchiveReader<'a> {
    fn poll_read(
        mut self: std::pin::Pin<&mut Self>,
        _cx: &mut std::task::Context<'_>,
        buf: &mut tokio::io::ReadBuf<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        if let Some(block) = &mut self.prev_block {
            let to_read = buf.remaining().min(block.len());
            let result = block.split_off(..to_read);
            let result = result.unwrap(); // SAFETY: above .min statement
            buf.put_slice(result);

            // If the block is empty, we can read more
            if block.is_empty() {
                self.prev_block = None;
            } else {
                return Poll::Ready(Ok(()));
            }
        }
        let block = match self.archive.read_block() {
            Ok(v) => v,
            Err(err) => return Poll::Ready(Err(std::io::Error::other(err.to_string()))),
        };

        let mut block = match block {
            Some(v) => v,
            None => return Poll::Ready(Ok(())),
        };

        let write_amount = buf.remaining().min(block.len());
        let to_write = block.split_off(..write_amount);
        let to_write = to_write.unwrap(); // SAFETY: above .min statement
        buf.put_slice(to_write);

        if !block.is_empty() {
            #[cfg(debug_assertions)]
            if self.prev_block.is_some() {
                panic!("replacing prev_block while it contains data")
            }
            self.prev_block.replace(&block[buf.remaining()..]);
        }

        Poll::Ready(Ok(()))
    }
}

#[async_trait]
impl VersionBackend for ZipVersionBackend {
    async fn list_files(&self) -> anyhow::Result<Vec<VersionFile>> {
        let mut archive = self.open_archive()?;
        let mut results = Vec::new();

        while let Some(header) = archive.next_header() {
            match header.filetype() {
                FileType::RegularFile => (),
                _ => {
                    continue;
                }
            }
            results.push(VersionFile {
                relative_filename: header.pathname().to_string(),
                permission: 0o744,
                size: header.size().try_into()?,
            });
        }

        Ok(results)
    }

    async fn reader(
        &self,
        file: &VersionFile,
        _start: u64,
        _end: u64,
    ) -> anyhow::Result<Box<dyn MinimumFileObject>> {
        let mut archive = self.open_archive()?;

        // Find entry in archive
        loop {
            let entry = match archive.next_header() {
                Some(v) => v,
                None => return Err(anyhow!("entry not found:{}", file.relative_filename)),
            };
            if entry.pathname() == file.relative_filename {
                break;
            }
        }

        Ok(Box::new(ArchiveReader {
            archive,
            prev_block: None,
        }))
    }

    async fn peek_file(&self, sub_path: String) -> anyhow::Result<VersionFile> {
        let files = self.list_files().await?;
        let file = files
            .iter()
            .find(|v| v.relative_filename == sub_path)
            .expect("file not found");

        Ok(file.clone())
    }

    fn require_whole_files(&self) -> bool {
        true
    }
}
