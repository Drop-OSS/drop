#![deny(clippy::all)]
#![feature(impl_trait_in_bindings)]
pub mod file_utils;
pub mod manifest;
pub mod ssl;
pub mod versions;
pub mod vm;

pub use manifest::{CHUNK_SIZE, MAX_FILE_COUNT};

#[cfg(test)]
pub mod tests;
