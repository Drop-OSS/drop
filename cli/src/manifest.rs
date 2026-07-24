use std::{collections::HashMap, path::Path};

use async_trait::async_trait;
use droplet_rs::manifest::{Manifest, ManifestWriterFactory, generate_manifest_rusty};
use indicatif::{ProgressBar, ProgressStyle};
use log::info;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWrite;

#[derive(Serialize, Deserialize)]
pub struct DepotManifest {
    content: HashMap<String, DepotManifestGameData>,
}
#[derive(Serialize, Deserialize)]
struct DepotManifestGameData {
    version_id: String,
    compression: CompressionOption,
}
#[derive(Serialize, Deserialize, Copy, Clone, Debug, PartialEq, Eq)]
pub enum CompressionOption {
    None,
    Gzip,
    Zstd,
}
impl DepotManifest {
    pub fn new() -> Self {
        Self {
            content: HashMap::new(),
        }
    }
    pub fn append(&mut self, game_id: String, version_id: String, compression: CompressionOption) {
        self.content.insert(
            game_id,
            DepotManifestGameData {
                version_id,
                compression,
            },
        );
    }
    pub fn is_empty(&self) -> bool {
        self.content.is_empty()
    }
    pub fn len(&self) -> usize {
        self.content.len()
    }
}

pub struct ClosureFactory<Writer, Factory, Closer>
where
    Writer: AsyncWrite + Unpin,
    Factory: AsyncFn(String) -> Writer,
    Closer: AsyncFn(Writer),
{
    writer: Factory,
    closer: Closer,
}

#[async_trait]
impl<
    W: AsyncWrite + Unpin + Send + Sync,
    F: AsyncFn(String) -> W + Send + Sync + 'static,
    C: AsyncFn(W) + Send + Sync,
> ManifestWriterFactory for ClosureFactory<W, F, C>
where
    for<'a> F::CallRefFuture<'a>: Send,
    for<'b> C::CallRefFuture<'b>: Send,
{
    type Writer = W;

    async fn create(&self, id: String) -> anyhow::Result<Self::Writer> {
        let func = &self.writer;
        let output = func(id).await;
        Ok(output)
    }
    async fn close(&self, writer: Self::Writer) -> anyhow::Result<()> {
        let func = &self.closer;
        func(writer).await;
        Ok(())
    }
}

impl<
    W: AsyncWrite + Unpin + Send + Sync,
    F: AsyncFn(String) -> W + Send + Sync + 'static,
    C: AsyncFn(W) + Sync,
> ClosureFactory<W, F, C>
where
    for<'a> F::CallRefFuture<'a>: Send,
    for<'b> C::CallRefFuture<'b>: Send,
{
    pub fn new(f: F, c: C) -> Self {
        Self {
            writer: f,
            closer: c,
        }
    }
}

pub async fn generate_v2_manifest<Factory>(dir: &Path, factory: Factory) -> anyhow::Result<Manifest>
where
    Factory: ManifestWriterFactory,
{
    let progress_bar = ProgressBar::new(10_000).with_style(
        ProgressStyle::default_bar()
            .template("[{elapsed_precise}] [ETA {eta}] {bar} {percent_precise}%")
            .unwrap(),
    );

    generate_manifest_rusty(
        dir,
        |progress| {
            let progress_int = (progress * 100f32).round() as u64;
            progress_bar.set_position(progress_int);
        },
        |log| progress_bar.suspend(|| info!("{}", log)),
        Some(&factory),
        None,
    )
    .await
}
