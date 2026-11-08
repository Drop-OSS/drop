#![feature(iterator_try_collect)]
#![feature(lock_value_accessors)]

pub mod collections;
pub mod downloads;
#[cfg(unix)]
pub mod epic_seed;
pub mod library;
pub mod scan;
pub mod state;
