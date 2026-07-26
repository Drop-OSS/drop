#![allow(non_camel_case_types, non_snake_case, non_upper_case_globals)]

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
    pub fn TsnetLoopback(
        sd: c_int,
        addr: *mut std::os::raw::c_char,
        addr_len: usize,
        proxy: *mut std::os::raw::c_char,
        local: *mut std::os::raw::c_char,
    ) -> c_int;
    pub fn TsnetDial(
        sd: c_int,
        network: *mut std::os::raw::c_char,
        addr: *mut std::os::raw::c_char,
        conn_out: *mut c_int,
    ) -> c_int;
    pub fn TsnetListen(
        sd: c_int,
        network: *mut std::os::raw::c_char,
        addr: *mut std::os::raw::c_char,
        listener_out: *mut c_int,
    ) -> c_int;
    pub fn TsnetEnableFunnelToLocalhostPlaintextHttp1(sd: c_int, port: c_int) -> c_int;
    pub fn TsnetErrmsg(sd: c_int, buf: *mut std::os::raw::c_char, len: usize) -> c_int;
}
