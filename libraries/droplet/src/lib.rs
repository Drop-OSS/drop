#![deny(clippy::all)]
// `#[async_trait]` emits `#[must_use]` on futures that are already `#[must_use]`, tripping `double_must_use`.
#![allow(clippy::double_must_use)]
#![feature(impl_trait_in_bindings)]
pub mod file_utils;
pub mod manifest;
pub mod ssl;
pub mod versions;
pub mod vm;

pub use manifest::{CHUNK_SIZE, MAX_FILE_COUNT};

#[cfg(test)]
pub mod tests;
