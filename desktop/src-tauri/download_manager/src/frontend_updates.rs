use database::DownloadableMetadata;
use serde::Serialize;

use crate::download_manager_frontend::DownloadStatus;

#[derive(Serialize, Clone)]
pub struct QueueUpdateEventQueueData {
    pub meta: DownloadableMetadata,
    pub status: DownloadStatus,
    pub dl_progress: f64,
    pub dl_current: usize,
    pub dl_max: usize,
    pub disk_progress: f64,
    pub disk_current: usize,
    pub disk_max: usize,
}

#[derive(Serialize, Clone)]
pub struct QueueUpdateEvent {
    pub queue: Vec<QueueUpdateEventQueueData>,
}

#[derive(Serialize, Clone)]
pub struct DownloadStatsUpdateEvent {
    pub speed: usize,
    pub time: usize,
}

#[derive(Serialize, Clone)]
pub struct DiskStatsUpdateEvent {
    pub speed: usize,
}
