use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub filename: String,
    pub start: usize,
    pub length: usize, // TODO: Replace with u64 for 32 bit clients
    pub permissions: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ChunkData {
    pub files: Vec<FileEntry>,
    pub checksum: String,
    pub iv: [u8; 16],
}

#[derive(Serialize, Deserialize)]
pub struct Manifest {
    pub version: String,
    pub chunks: HashMap<String, ChunkData>,
    pub size: u64,
    pub key: [u8; 16],
}
