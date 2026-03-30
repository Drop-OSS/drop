use tokio::sync::Semaphore;
pub mod downloads;
pub mod state;
pub mod util;
pub mod proto;
pub mod conversions;
pub mod server;
pub mod droplet;

pub use downloads::download::DownloadContext;

static GLOBAL_CONTEXT_SEMAPHORE: Semaphore = Semaphore::const_new(1);
