//! Library entry point for the `downpour` crate.
//!
//! Exposes internals so integration tests in `tests/` can access them via
//! `use downpour::...`. The binary (`main.rs`) consumes this same API.

#![feature(async_fn_traits)]

pub mod cli;
pub mod commands;
pub mod logging;
pub mod manifest;
pub mod operator_builder;
