use std::{env, path::PathBuf};

use droplet_rs::manifest::{generate_manifest_rusty, ManifestWriterFactory};
use tokio::runtime::Handle;

struct SinkFactory {}
#[async_trait::async_trait]
impl ManifestWriterFactory for SinkFactory {
    type Writer = tokio::io::Sink;
    async fn create(&self, _id: String) -> anyhow::Result<Self::Writer> {
        Ok(tokio::io::sink())
    }

    async fn close(&self, _writer: Self::Writer) -> anyhow::Result<()> {
        Ok(())
    }
}

#[tokio::main]
pub async fn main() {
    let mut args = env::args();
    let target_dir = PathBuf::from(args.nth(1).expect("Provide target directory"));

    let metrics = Handle::current().metrics();
    println!("using {} workers", metrics.num_workers());

    let _manifest = generate_manifest_rusty(
        &target_dir,
        |progress| println!("PROGRESS: {}", progress),
        |message| {
            println!("{}", message);
        },
        Some(&SinkFactory {}),
        None,
    )
    .await
    .unwrap();
}
