#![allow(non_upper_case_globals)]
#![allow(non_camel_case_types)]
#![allow(non_snake_case)]

use std::ffi::{CStr, CString};
use std::io::{Read, Write};
#[cfg(not(target_os = "windows"))]
use std::os::fd::{AsRawFd, RawFd};
#[cfg(target_os = "windows")]
use std::os::windows::io::{AsRawHandle, RawHandle};
use std::os::raw::{c_char, c_int};
mod bindings;
#[cfg(test)]
mod test;

type GoInt = i64;

use bindings::*;
use libc;

#[derive(Debug)]
pub enum TailscaleError {
    ApiError(c_int, String),
    BadFileDescriptor,
    BufferTooSmall,
    NulError(std::ffi::NulError),
    InvalidUtf8(std::str::Utf8Error),
    IoError(std::io::Error),
    InvalidHandle,
}

impl From<std::ffi::NulError> for TailscaleError {
    fn from(err: std::ffi::NulError) -> Self {
        TailscaleError::NulError(err)
    }
}

impl From<std::str::Utf8Error> for TailscaleError {
    fn from(err: std::str::Utf8Error) -> Self {
        TailscaleError::InvalidUtf8(err)
    }
}

impl From<std::io::Error> for TailscaleError {
    fn from(err: std::io::Error) -> Self {
        TailscaleError::IoError(err)
    }
}

// Helper function to get error message from the server handle
// This helper is needed because TsnetErrmsg requires the server handle (sd)
fn get_tsnet_errmsg(sd: c_int) -> String {
    let mut buf = [0u8; 256]; // Choose a reasonable buffer size
    let message = unsafe { TsnetErrmsg(sd, buf.as_mut_ptr() as *mut c_char, buf.len()) };

    if message == 0 {
        let c_str = unsafe { CStr::from_ptr(buf.as_ptr() as *const c_char) };
        c_str.to_string_lossy().into_owned()
    } else {
        format!(
            "(Failed to get error message, TsnetErrmsg returned {})",
            message
        )
    }
}

fn parse_tsnet_result(sd: c_int, ret: c_int) -> Result<(), TailscaleError> {
    match ret {
        0 => Ok(()),
        code if code == libc::EBADF => Err(TailscaleError::BadFileDescriptor),
        code if code == libc::ERANGE => Err(TailscaleError::BufferTooSmall),
        _ => {
            let message = get_tsnet_errmsg(sd);
            Err(TailscaleError::ApiError(ret, message))
        }
    }
}

pub struct Tailscale(c_int);

// A TailscaleListener is a socket on the tailnet listening for connections.
//
// It is much like allocating a system socket(2) and calling listen(2).
// Accept connections with tailscale_accept and close the listener  with close.
//
// Under the hood, a tailscale_listener is one half of a socketpair itself,
// used to move the connection fd from Go to C. This means you can use epoll
// or its equivalent on a tailscale_listener to know if there is a connection
// read to accept.
pub struct TailscaleListener(c_int);

// A TailscaleConn is a connection to an address on the tailnet.
//
// It is a pipe(2) on which you can use read(2), write(2), and close(2).
// For extra control over the connection, see the tailscale_conn_* functions.
pub struct TailscaleConn(c_int);

// NEEDS REVIEW. CANNOT BE BADLY DONE
impl Drop for Tailscale {
    fn drop(&mut self) {
        let ret = unsafe { TsnetClose(self.0) };
        if ret != 0 && ret != libc::EBADF {
            eprintln!("Error closing Tailscale server {}: {}", self.0, ret);
        }
    }
}

impl Drop for TailscaleListener {
    fn drop(&mut self) {
        // TailscaleListener is treated like a file descriptor.
        let ret = unsafe { libc::close(self.0) };
        if ret != 0 && ret != libc::EBADF {
            eprintln!("Error closing Tailscale listener {}: {}", self.0, ret);
        }
    }
}

impl Drop for TailscaleConn {
    fn drop(&mut self) {
        // TailscaleConn is treated like a file descriptor (pipe).
        let ret = unsafe { libc::close(self.0) };
        if ret != 0 && ret != libc::EBADF {
            eprintln!("Error closing Tailscale connection {}: {}", self.0, ret);
        }
    }
}

impl Tailscale {
    pub fn new() -> Self {
        Tailscale(unsafe { TsnetNewServer() })
    }

    pub fn start(&self) -> Result<(), TailscaleError> {
        let ret = unsafe { TsnetStart(self.0) };
        parse_tsnet_result(self.0, ret)
    }

    pub fn up(&self) -> Result<(), TailscaleError> {
        let ret = unsafe { TsnetUp(self.0) };
        parse_tsnet_result(self.0, ret)
    }

    pub fn close(&self) -> Result<(), TailscaleError> {
        let ret = unsafe { TsnetClose(self.0) };
        parse_tsnet_result(self.0, ret)
    }

    pub fn set_dir(&self, dir: &str) -> Result<(), TailscaleError> {
        let c_dir = CString::new(dir)?;
        let ret = unsafe { TsnetSetDir(self.0, c_dir.as_ptr() as *mut c_char) };
        parse_tsnet_result(self.0, ret)
    }

    pub fn set_hostname<T: AsRef<str>>(&self, hostname: T) -> Result<(), TailscaleError> {
        let c_hostname = CString::new(hostname.as_ref())?;
        let ret = unsafe { TsnetSetHostname(self.0, c_hostname.as_ptr() as *mut c_char) };
        parse_tsnet_result(self.0, ret)
    }

    pub fn set_authkey(&self, authkey: &str) -> Result<(), TailscaleError> {
        let c_authkey = CString::new(authkey)?;
        let ret = unsafe { TsnetSetAuthKey(self.0, c_authkey.as_ptr() as *mut c_char) };
        parse_tsnet_result(self.0, ret)
    }

    pub fn set_control_url(&self, control_url: &str) -> Result<(), TailscaleError> {
        let c_control_url = CString::new(control_url)?;
        let ret = unsafe { TsnetSetControlURL(self.0, c_control_url.as_ptr() as *mut c_char) };
        parse_tsnet_result(self.0, ret)
    }

    pub fn set_ephemeral(&self, ephemeral: bool) -> Result<(), TailscaleError> {
        let e: GoInt = if ephemeral { 1 } else { 0 };
        // Use GoInt (i64) based on bindgen output
        let ret = unsafe { TsnetSetEphemeral(self.0, e) };
        parse_tsnet_result(self.0, ret)
    }

    pub fn set_log_fd(&self, fd: i32) -> Result<(), TailscaleError> {
        let ret = unsafe { TsnetSetLogFD(self.0, fd) };
        parse_tsnet_result(self.0, ret)
    }

    pub fn get_ips<'a>(&self, buf: &'a mut [u8]) -> Result<&'a str, TailscaleError> {
        let ret = unsafe { TsnetGetIps(self.0, buf.as_mut_ptr() as *mut c_char, buf.len()) };
        match ret {
            0 => {
                let c_str = unsafe { CStr::from_ptr(buf.as_ptr() as *const c_char) };
                c_str.to_str().map_err(TailscaleError::from) // Convert Utf8Error
            }
            code if code == libc::EBADF => Err(TailscaleError::BadFileDescriptor),
            code if code == libc::ERANGE => Err(TailscaleError::BufferTooSmall),
            _ => {
                let err_msg = get_tsnet_errmsg(self.0);
                Err(TailscaleError::ApiError(ret, err_msg))
            }
        }
    }

    pub fn loopback(
        &self,
        addr_buf: &mut [u8],
        proxy_buf: &mut [u8],
        local_buf: &mut [u8],
    ) -> Result<(), TailscaleError> {
        // C header says proxy_out and local_out must hold 33 bytes.
        if proxy_buf.len() < 33 || local_buf.len() < 33 {
            return Err(TailscaleError::BufferTooSmall); // Custom check based on docs
        }

        let ret = unsafe {
            TsnetLoopback(
                self.0,
                addr_buf.as_mut_ptr() as *mut c_char,
                addr_buf.len(),
                proxy_buf.as_mut_ptr() as *mut c_char,
                local_buf.as_mut_ptr() as *mut c_char,
            )
        };

        parse_tsnet_result(self.0, ret)
    }
    pub fn dial(&self, network: &str, addr: &str) -> Result<TailscaleConn, TailscaleError> {
        let c_network = CString::new(network)?;
        let c_addr = CString::new(addr)?;
        let mut conn_out: c_int = -1;
        let ret = unsafe {
            TsnetDial(
                self.0,
                c_network.as_ptr() as *mut c_char,
                c_addr.as_ptr() as *mut c_char,
                &mut conn_out,
            )
        };

        parse_tsnet_result(self.0, ret)?;

        if ret == 0 && conn_out != -1 {
            Ok(TailscaleConn(conn_out))
        } else if ret == 0 {
            Err(TailscaleError::InvalidHandle)
        } else {
            unreachable!();
        }
    }
    pub fn listen(&self, network: &str, addr: &str) -> Result<TailscaleListener, TailscaleError> {
        let c_network = CString::new(network)?;
        let c_addr = CString::new(addr)?;
        let mut listener_out: c_int = -1; // Use c_int for the output pointer
        let ret = unsafe {
            TsnetListen(
                self.0,
                c_network.as_ptr() as *mut c_char,
                c_addr.as_ptr() as *mut c_char,
                &mut listener_out,
            )
        };

        parse_tsnet_result(self.0, ret)?;

        if ret == 0 && listener_out != -1 {
            Ok(TailscaleListener(listener_out))
        } else if ret == 0 {
            Err(TailscaleError::InvalidHandle)
        } else {
            unreachable!();
        }
    }

    pub fn enable_funnel_to_localhost_plaintext_http1(
        &self,
        localhost_port: i32,
    ) -> Result<(), TailscaleError> {
        let ret =
            unsafe { TsnetEnableFunnelToLocalhostPlaintextHttp1(self.0, localhost_port as c_int) };
        parse_tsnet_result(self.0, ret)
    }

    pub fn get_last_error_message<'a>(&self, buf: &'a mut [u8]) -> Result<&'a str, TailscaleError> {
        let ret = unsafe { TsnetErrmsg(self.0, buf.as_mut_ptr() as *mut c_char, buf.len()) };
        match ret {
            0 => {
                let c_str = unsafe { CStr::from_ptr(buf.as_ptr() as *const c_char) };
                c_str.to_str().map_err(TailscaleError::from) // Convert Utf8Error
            }
            code if code == libc::EBADF => Err(TailscaleError::BadFileDescriptor),
            code if code == libc::ERANGE => Err(TailscaleError::BufferTooSmall),
            // TsnetErrmsg should ideally not return other codes, but handle defensively
            _ => Err(TailscaleError::ApiError(
                ret,
                format!("TsnetErrmsg returned unknown code {}", ret),
            )),
        }
    }
}

#[cfg(not(target_os = "windows"))]
// Requires the connection handle to behave like a raw file descriptor.
impl AsRawFd for TailscaleConn {
    fn as_raw_fd(&self) -> RawFd {
        self.0
    }
}
#[cfg(target_os = "windows")]
impl AsRawHandle for TailscaleConn {
    fn as_raw_handle(&self) -> RawHandle {
        self.0
    }
}

impl Read for TailscaleConn {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        #[cfg(not(target_os = "windows"))]
        let fd = self.as_raw_fd();
        #[cfg(target_os = "windows")]
        let fd = self.as_raw_handle();
        // Safety: Calling libc::read on a valid file descriptor.
        // The caller must ensure the handle is valid for reading (it is after successful dial/accept).
        let n = unsafe {
            libc::read(fd, buf.as_mut_ptr() as *mut libc::c_void, buf.len())
        };
        if n < 0 {
            Err(std::io::Error::last_os_error())
        } else {
            Ok(n as usize)
        }
    }
}

impl Write for TailscaleConn {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {

        let fd = self.as_raw_fd();
        // Safety: Calling libc::write on a valid file descriptor.
        // The caller must ensure the handle is valid for writing (it is after successful dial/accept).
        let n = unsafe {
            libc::write(fd, buf.as_ptr() as *const libc::c_void, buf.len())
        };
        if n < 0 {
            Err(std::io::Error::last_os_error())
        } else {
            Ok(n as usize)
        }
    }

    fn flush(&mut self) -> std::io::Result<()> {
        // For a pipe/socket, flush is often a no-op after write.
        Ok(())
    }
}
