extern crate bindgen;

use abs_file_macro::abs_file;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    println!("cargo::rustc-check-cfg=cfg(libtailscale_available)");
    let build_folder = PathBuf::from(abs_file!());
    let build_folder = build_folder.parent().unwrap();

    let in_path = build_folder.join("libtailscale");
    let out_path = build_folder.join("src/");

    if !in_path.exists() {
        std::fs::write(
            out_path.join("bindings.rs"),
            r#"#![allow(non_camel_case_types, non_snake_case, non_upper_case_globals)]

pub type GoInt = i64;
pub type c_int = i32;

unsafe extern "C" {
    pub fn TsnetNewServer() -> c_int;
    pub fn TsnetStart(sd: c_int) -> c_int;
    pub fn TsnetUp(sd: c_int) -> c_int;
    pub fn TsnetClose(sd: c_int) -> c_int;
    pub fn TsnetSetDir(sd: c_int, dir: *mut std::os::raw::c_char) -> c_int;
    pub fn TsnetSetHostname(sd: c_int, hostname: *mut std::os::raw::c_char) -> c_int;
    pub fn TsnetSetAuthKey(sd: c_int, authkey: *mut std::os::raw::c_char) -> c_int;
    pub fn TsnetSetControlURL(sd: c_int, url: *mut std::os::raw::c_char) -> c_int;
    pub fn TsnetSetEphemeral(sd: c_int, ephemeral: GoInt) -> c_int;
    pub fn TsnetSetLogFD(sd: c_int, fd: c_int) -> c_int;
    pub fn TsnetGetIps(sd: c_int, buf: *mut std::os::raw::c_char, len: usize) -> c_int;
    pub fn TsnetLoopback(sd: c_int, addr: *mut std::os::raw::c_char, addr_len: usize, proxy: *mut std::os::raw::c_char, local: *mut std::os::raw::c_char) -> c_int;
    pub fn TsnetDial(sd: c_int, network: *mut std::os::raw::c_char, addr: *mut std::os::raw::c_char, conn_out: *mut c_int) -> c_int;
    pub fn TsnetListen(sd: c_int, network: *mut std::os::raw::c_char, addr: *mut std::os::raw::c_char, listener_out: *mut c_int) -> c_int;
    pub fn TsnetEnableFunnelToLocalhostPlaintextHttp1(sd: c_int, port: c_int) -> c_int;
    pub fn TsnetErrmsg(sd: c_int, buf: *mut std::os::raw::c_char, len: usize) -> c_int;
}
"#,
        )
        .expect("Couldn't write stub bindings!");
        return;
    }

    let mut make_cmd = Command::new("make");
    make_cmd.arg("c-archive");
    make_cmd.current_dir(in_path.clone());

    make_cmd.status().expect("Make build failed");

    let bindings = bindgen::Builder::default()
        .header(in_path.join("libtailscale.h").to_str().unwrap())
        .parse_callbacks(Box::new(bindgen::CargoCallbacks::new()))
        .generate()
        .expect("Unable to generate bindings");

    bindings
        .write_to_file(out_path.join("bindings.rs"))
        .expect("Couldn't write bindings!");

    println!("cargo:rerun-if-changed=libtailscale/tailscale.go");
    println!(
        "cargo:rustc-link-search=native={}",
        in_path.to_str().unwrap()
    );
    println!("cargo:rustc-link-lib=static={}", "tailscale");
    println!("cargo:rustc-cfg=libtailscale_available");
}
