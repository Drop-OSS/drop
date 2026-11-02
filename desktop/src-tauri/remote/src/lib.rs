#![feature(slice_concat_trait)]
#![feature(sync_nonpoison)]
#![feature(nonpoison_mutex)]

#[macro_use]
pub mod auth;
pub mod cache;
pub mod error;
pub mod fetch_object;
pub mod profiles;
pub mod requests;
pub mod server_proto;
pub mod utils;

pub use auth::setup;
