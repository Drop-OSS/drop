use tokio::sync::Semaphore;
pub mod conversions;
pub mod downloads;
pub mod droplet;
pub mod proto;
pub mod server;
pub mod state;
pub mod util;

pub use downloads::download::DownloadContext;

static GLOBAL_CONTEXT_SEMAPHORE: Semaphore = Semaphore::const_new(1);
