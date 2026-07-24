#![feature(nonpoison_rwlock)]

pub mod db;
pub mod debug;
pub mod interface;
pub mod models;
pub mod platform;

#[cfg(test)]
mod tests;

pub use db::DB;
pub use interface::{borrow_db_checked, borrow_db_mut_checked};
pub use models::data::{
    ApplicationTransientStatus, Database, DatabaseApplications, DatabaseAuth, DownloadType,
    DownloadableMetadata, GameDownloadStatus, GameVersion, Settings,
};
