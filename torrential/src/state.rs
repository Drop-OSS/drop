use std::sync::Arc;

use dashmap::DashMap;

use crate::{DownloadContext, server::DropServer};

pub struct AppState {
    pub context_cache: DashMap<(String, String), DownloadContext>,
    pub server: Arc<DropServer>,
}
