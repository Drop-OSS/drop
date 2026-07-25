use std::collections::HashMap;
use std::ffi::CStr;
use std::os::raw::c_char;

use crate::{Tailscale, TailscaleConn, TailscaleError, TailscaleListener};

/// Trait abstracting the Tailscale API for dependency injection and testing.
///
/// Implementations:
/// - [`Tailscale`] — real FFI-backed implementation
/// - [`MockTailscale`] — configurable mock for unit tests
pub trait TailscaleProvider {
    /// Socket-like handle for accepting tailnet connections.
    type Listener;
    /// Socket-like handle for communicating over a tailnet connection.
    type Conn;

    /// Create a new server instance.
    fn new() -> Self;
    /// Start the tailscale server.
    fn start(&self) -> Result<(), TailscaleError>;
    /// Bring the tailnet interface up.
    fn up(&self) -> Result<(), TailscaleError>;
    /// Close the tailscale server.
    fn close(&self) -> Result<(), TailscaleError>;
    /// Set the directory for tailscale state.
    fn set_dir(&self, dir: &str) -> Result<(), TailscaleError>;
    /// Set the tailnet hostname.
    fn set_hostname(&self, hostname: &str) -> Result<(), TailscaleError>;
    /// Set the auth key for pre-authenticated join.
    fn set_authkey(&self, authkey: &str) -> Result<(), TailscaleError>;
    /// Set a custom control URL (for headscale, etc.).
    fn set_control_url(&self, control_url: &str) -> Result<(), TailscaleError>;
    /// Set whether the node is ephemeral (disappears on disconnect).
    fn set_ephemeral(&self, ephemeral: bool) -> Result<(), TailscaleError>;
    /// Set a file descriptor for logging.
    fn set_log_fd(&self, fd: i32) -> Result<(), TailscaleError>;
    /// Get assigned tailnet IPs.
    fn get_ips<'a>(&self, buf: &'a mut [u8]) -> Result<&'a str, TailscaleError>;
    /// Resolve loopback addresses (addr, proxied, local).
    fn loopback(
        &self,
        addr_buf: &mut [u8],
        proxy_buf: &mut [u8],
        local_buf: &mut [u8],
    ) -> Result<(), TailscaleError>;
    /// Dial an address on the tailnet.
    fn dial(&self, network: &str, addr: &str) -> Result<Self::Conn, TailscaleError>;
    /// Listen on an address on the tailnet.
    fn listen(&self, network: &str, addr: &str) -> Result<Self::Listener, TailscaleError>;
    /// Enable funnel to a localhost HTTP/1.1 port.
    fn enable_funnel_to_localhost_plaintext_http1(
        &self,
        localhost_port: i32,
    ) -> Result<(), TailscaleError>;
    /// Get the last error message from the tailscale server.
    fn get_last_error_message<'a>(&self, buf: &'a mut [u8]) -> Result<&'a str, TailscaleError>;
}

// ---------------------------------------------------------------------------
// Real implementation backed by the existing FFI code
// ---------------------------------------------------------------------------

impl TailscaleProvider for Tailscale {
    type Listener = TailscaleListener;
    type Conn = TailscaleConn;

    fn new() -> Self {
        Tailscale::new()
    }

    fn start(&self) -> Result<(), TailscaleError> {
        self.start()
    }

    fn up(&self) -> Result<(), TailscaleError> {
        self.up()
    }

    fn close(&self) -> Result<(), TailscaleError> {
        self.close()
    }

    fn set_dir(&self, dir: &str) -> Result<(), TailscaleError> {
        self.set_dir(dir)
    }

    fn set_hostname(&self, hostname: &str) -> Result<(), TailscaleError> {
        // &str implements AsRef<str>, so delegation works directly.
        self.set_hostname(hostname)
    }

    fn set_authkey(&self, authkey: &str) -> Result<(), TailscaleError> {
        self.set_authkey(authkey)
    }

    fn set_control_url(&self, control_url: &str) -> Result<(), TailscaleError> {
        self.set_control_url(control_url)
    }

    fn set_ephemeral(&self, ephemeral: bool) -> Result<(), TailscaleError> {
        self.set_ephemeral(ephemeral)
    }

    fn set_log_fd(&self, fd: i32) -> Result<(), TailscaleError> {
        self.set_log_fd(fd)
    }

    fn get_ips<'a>(&self, buf: &'a mut [u8]) -> Result<&'a str, TailscaleError> {
        self.get_ips(buf)
    }

    fn loopback(
        &self,
        addr_buf: &mut [u8],
        proxy_buf: &mut [u8],
        local_buf: &mut [u8],
    ) -> Result<(), TailscaleError> {
        self.loopback(addr_buf, proxy_buf, local_buf)
    }

    fn dial(&self, network: &str, addr: &str) -> Result<Self::Conn, TailscaleError> {
        self.dial(network, addr)
    }

    fn listen(&self, network: &str, addr: &str) -> Result<Self::Listener, TailscaleError> {
        self.listen(network, addr)
    }

    fn enable_funnel_to_localhost_plaintext_http1(
        &self,
        localhost_port: i32,
    ) -> Result<(), TailscaleError> {
        self.enable_funnel_to_localhost_plaintext_http1(localhost_port)
    }

    fn get_last_error_message<'a>(&self, buf: &'a mut [u8]) -> Result<&'a str, TailscaleError> {
        self.get_last_error_message(buf)
    }
}

// ---------------------------------------------------------------------------
// Mock implementation for testing
// ---------------------------------------------------------------------------

/// Placeholder connection handle returned by `MockTailscale::dial`.
#[derive(Debug)]
pub struct MockConn;

/// Placeholder listener handle returned by `MockTailscale::listen`.
#[derive(Debug)]
pub struct MockListener;

/// Pre-defined response value carried by a mock expectation.
#[derive(Debug, Clone)]
pub enum MockResponse {
    /// For methods returning `Result<(), TailscaleError>`.
    Unit,
    /// For methods returning `Result<&str, TailscaleError>` (get_ips, get_last_error_message).
    Str(String),
    /// For `dial()`.
    Conn,
    /// For `listen()`.
    Listener,
}

/// An expectation for a single mock method call.
#[derive(Debug, Clone)]
pub enum MockExpectation {
    /// The call should succeed and return the given response.
    Success(MockResponse),
    /// The call should fail with the given error message.
    Error(String),
}

/// A configurable mock implementation of [`TailscaleProvider`].
///
/// Each method looks up its name in `expectations`. If no expectation is set,
/// the method returns `ApiError(-1, "no mock expectation for {method}")`.
///
/// # Example
///
/// ```
/// use tailscale::provider::{
///     MockExpectation, MockResponse, MockTailscale, TailscaleProvider,
/// };
///
/// let mock = MockTailscale::new().expect(
///     "start",
///     MockExpectation::Success(MockResponse::Unit),
/// );
/// assert!(mock.start().is_ok());
/// ```
#[derive(Debug)]
pub struct MockTailscale {
    expectations: HashMap<String, MockExpectation>,
}

impl Default for MockTailscale {
    fn default() -> Self {
        Self::new()
    }
}

impl MockTailscale {
    /// Create a new `MockTailscale` with no expectations set.
    pub fn new() -> Self {
        Self {
            expectations: HashMap::new(),
        }
    }

    /// Add an expectation for `method`. Returns self for chaining.
    pub fn expect(mut self, method: &str, expectation: MockExpectation) -> Self {
        self.expectations.insert(method.to_string(), expectation);
        self
    }
}

impl MockTailscale {
    fn get_expectation(&self, method: &str) -> Result<MockResponse, TailscaleError> {
        match self.expectations.get(method) {
            Some(MockExpectation::Success(resp)) => Ok(resp.clone()),
            Some(MockExpectation::Error(msg)) => Err(TailscaleError::ApiError(-1, msg.clone())),
            None => Err(TailscaleError::ApiError(
                -1,
                format!("no mock expectation for {method}"),
            )),
        }
    }
}

impl TailscaleProvider for MockTailscale {
    type Listener = MockListener;
    type Conn = MockConn;

    fn new() -> Self {
        Self::new()
    }

    fn start(&self) -> Result<(), TailscaleError> {
        self.get_expectation("start").and_then(|r| match r {
            MockResponse::Unit => Ok(()),
            _ => Err(TailscaleError::ApiError(
                -1,
                "wrong mock response type for start".into(),
            )),
        })
    }

    fn up(&self) -> Result<(), TailscaleError> {
        self.get_expectation("up").and_then(|r| match r {
            MockResponse::Unit => Ok(()),
            _ => Err(TailscaleError::ApiError(
                -1,
                "wrong mock response type for up".into(),
            )),
        })
    }

    fn close(&self) -> Result<(), TailscaleError> {
        self.get_expectation("close").and_then(|r| match r {
            MockResponse::Unit => Ok(()),
            _ => Err(TailscaleError::ApiError(
                -1,
                "wrong mock response type for close".into(),
            )),
        })
    }

    fn set_dir(&self, _dir: &str) -> Result<(), TailscaleError> {
        self.get_expectation("set_dir").and_then(|r| match r {
            MockResponse::Unit => Ok(()),
            _ => Err(TailscaleError::ApiError(
                -1,
                "wrong mock response type for set_dir".into(),
            )),
        })
    }

    fn set_hostname(&self, _hostname: &str) -> Result<(), TailscaleError> {
        self.get_expectation("set_hostname").and_then(|r| match r {
            MockResponse::Unit => Ok(()),
            _ => Err(TailscaleError::ApiError(
                -1,
                "wrong mock response type for set_hostname".into(),
            )),
        })
    }

    fn set_authkey(&self, _authkey: &str) -> Result<(), TailscaleError> {
        self.get_expectation("set_authkey").and_then(|r| match r {
            MockResponse::Unit => Ok(()),
            _ => Err(TailscaleError::ApiError(
                -1,
                "wrong mock response type for set_authkey".into(),
            )),
        })
    }

    fn set_control_url(&self, _control_url: &str) -> Result<(), TailscaleError> {
        self.get_expectation("set_control_url")
            .and_then(|r| match r {
                MockResponse::Unit => Ok(()),
                _ => Err(TailscaleError::ApiError(
                    -1,
                    "wrong mock response type for set_control_url".into(),
                )),
            })
    }

    fn set_ephemeral(&self, _ephemeral: bool) -> Result<(), TailscaleError> {
        self.get_expectation("set_ephemeral").and_then(|r| match r {
            MockResponse::Unit => Ok(()),
            _ => Err(TailscaleError::ApiError(
                -1,
                "wrong mock response type for set_ephemeral".into(),
            )),
        })
    }

    fn set_log_fd(&self, _fd: i32) -> Result<(), TailscaleError> {
        self.get_expectation("set_log_fd").and_then(|r| match r {
            MockResponse::Unit => Ok(()),
            _ => Err(TailscaleError::ApiError(
                -1,
                "wrong mock response type for set_log_fd".into(),
            )),
        })
    }

    fn get_ips<'a>(&self, buf: &'a mut [u8]) -> Result<&'a str, TailscaleError> {
        match self.get_expectation("get_ips")? {
            MockResponse::Str(s) => {
                let bytes = s.as_bytes();
                let len = bytes.len().min(buf.len().saturating_sub(1));
                buf[..len].copy_from_slice(&bytes[..len]);
                buf[len] = 0;
                let c_str = unsafe { CStr::from_ptr(buf.as_ptr() as *const c_char) };
                c_str.to_str().map_err(TailscaleError::from)
            }
            _ => Err(TailscaleError::ApiError(
                -1,
                "wrong mock response type for get_ips".into(),
            )),
        }
    }

    fn loopback(
        &self,
        _addr_buf: &mut [u8],
        _proxy_buf: &mut [u8],
        _local_buf: &mut [u8],
    ) -> Result<(), TailscaleError> {
        self.get_expectation("loopback").and_then(|r| match r {
            MockResponse::Unit => Ok(()),
            _ => Err(TailscaleError::ApiError(
                -1,
                "wrong mock response type for loopback".into(),
            )),
        })
    }

    fn dial(&self, _network: &str, _addr: &str) -> Result<Self::Conn, TailscaleError> {
        self.get_expectation("dial").and_then(|r| match r {
            MockResponse::Conn => Ok(MockConn),
            _ => Err(TailscaleError::ApiError(
                -1,
                "wrong mock response type for dial".into(),
            )),
        })
    }

    fn listen(&self, _network: &str, _addr: &str) -> Result<Self::Listener, TailscaleError> {
        self.get_expectation("listen").and_then(|r| match r {
            MockResponse::Listener => Ok(MockListener),
            _ => Err(TailscaleError::ApiError(
                -1,
                "wrong mock response type for listen".into(),
            )),
        })
    }

    fn enable_funnel_to_localhost_plaintext_http1(
        &self,
        _localhost_port: i32,
    ) -> Result<(), TailscaleError> {
        self.get_expectation("enable_funnel_to_localhost_plaintext_http1")
            .and_then(|r| match r {
                MockResponse::Unit => Ok(()),
                _ => Err(TailscaleError::ApiError(
                    -1,
                    "wrong mock response type for enable_funnel_to_localhost_plaintext_http1"
                        .into(),
                )),
            })
    }

    fn get_last_error_message<'a>(&self, buf: &'a mut [u8]) -> Result<&'a str, TailscaleError> {
        match self.get_expectation("get_last_error_message")? {
            MockResponse::Str(s) => {
                let bytes = s.as_bytes();
                let len = bytes.len().min(buf.len().saturating_sub(1));
                buf[..len].copy_from_slice(&bytes[..len]);
                buf[len] = 0;
                let c_str = unsafe { CStr::from_ptr(buf.as_ptr() as *const c_char) };
                c_str.to_str().map_err(TailscaleError::from)
            }
            _ => Err(TailscaleError::ApiError(
                -1,
                "wrong mock response type for get_last_error_message".into(),
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_start_success() {
        let mock =
            MockTailscale::new().expect("start", MockExpectation::Success(MockResponse::Unit));
        assert!(mock.start().is_ok());
    }

    #[test]
    fn mock_start_error() {
        let mock =
            MockTailscale::new().expect("start", MockExpectation::Error("start failed".into()));
        let err = mock.start().unwrap_err();
        match err {
            TailscaleError::ApiError(-1, msg) => assert_eq!(msg, "start failed"),
            _ => panic!("expected ApiError, got {err:?}"),
        }
    }

    #[test]
    fn mock_no_expectation_returns_error() {
        let mock = MockTailscale::new();
        let err = mock.start().unwrap_err();
        match err {
            TailscaleError::ApiError(-1, msg) => {
                assert!(msg.contains("no mock expectation for start"))
            }
            _ => panic!("expected ApiError, got {err:?}"),
        }
    }

    #[test]
    fn mock_up_success() {
        let mock = MockTailscale::new().expect("up", MockExpectation::Success(MockResponse::Unit));
        assert!(mock.up().is_ok());
    }

    #[test]
    fn mock_close_success() {
        let mock =
            MockTailscale::new().expect("close", MockExpectation::Success(MockResponse::Unit));
        assert!(mock.close().is_ok());
    }

    #[test]
    fn mock_set_dir_success() {
        let mock =
            MockTailscale::new().expect("set_dir", MockExpectation::Success(MockResponse::Unit));
        assert!(mock.set_dir("/tmp/tailscale").is_ok());
    }

    #[test]
    fn mock_set_hostname_success() {
        let mock = MockTailscale::new()
            .expect("set_hostname", MockExpectation::Success(MockResponse::Unit));
        assert!(mock.set_hostname("my-node").is_ok());
    }

    #[test]
    fn mock_set_authkey_success() {
        let mock = MockTailscale::new()
            .expect("set_authkey", MockExpectation::Success(MockResponse::Unit));
        assert!(mock.set_authkey("tskey-xxx").is_ok());
    }

    #[test]
    fn mock_set_control_url_success() {
        let mock = MockTailscale::new().expect(
            "set_control_url",
            MockExpectation::Success(MockResponse::Unit),
        );
        assert!(mock
            .set_control_url("https://headscale.example.com")
            .is_ok());
    }

    #[test]
    fn mock_set_ephemeral_success() {
        let mock = MockTailscale::new().expect(
            "set_ephemeral",
            MockExpectation::Success(MockResponse::Unit),
        );
        assert!(mock.set_ephemeral(true).is_ok());
    }

    #[test]
    fn mock_set_log_fd_success() {
        let mock =
            MockTailscale::new().expect("set_log_fd", MockExpectation::Success(MockResponse::Unit));
        assert!(mock.set_log_fd(42).is_ok());
    }

    #[test]
    fn mock_get_ips_success() {
        let expected_ips = "100.64.0.1";
        let mock = MockTailscale::new().expect(
            "get_ips",
            MockExpectation::Success(MockResponse::Str(expected_ips.into())),
        );
        let mut buf = [0u8; 64];
        let ips = mock.get_ips(&mut buf).unwrap();
        assert_eq!(ips, expected_ips);
    }

    #[test]
    fn mock_loopback_success() {
        let mock =
            MockTailscale::new().expect("loopback", MockExpectation::Success(MockResponse::Unit));
        let mut addr = [0u8; 64];
        let mut proxy = [0u8; 64];
        let mut local = [0u8; 64];
        assert!(mock.loopback(&mut addr, &mut proxy, &mut local).is_ok());
    }

    #[test]
    fn mock_dial_success() {
        let mock =
            MockTailscale::new().expect("dial", MockExpectation::Success(MockResponse::Conn));
        let conn = mock.dial("tcp", "100.64.0.1:80");
        assert!(conn.is_ok());
    }

    #[test]
    fn mock_listen_success() {
        let mock =
            MockTailscale::new().expect("listen", MockExpectation::Success(MockResponse::Listener));
        let listener = mock.listen("tcp", ":8080");
        assert!(listener.is_ok());
    }

    #[test]
    fn mock_enable_funnel_success() {
        let mock = MockTailscale::new().expect(
            "enable_funnel_to_localhost_plaintext_http1",
            MockExpectation::Success(MockResponse::Unit),
        );
        assert!(mock
            .enable_funnel_to_localhost_plaintext_http1(8080)
            .is_ok());
    }

    #[test]
    fn mock_get_last_error_message_success() {
        let expected_msg = "something went wrong";
        let mock = MockTailscale::new().expect(
            "get_last_error_message",
            MockExpectation::Success(MockResponse::Str(expected_msg.into())),
        );
        let mut buf = [0u8; 256];
        let msg = mock.get_last_error_message(&mut buf).unwrap();
        assert_eq!(msg, expected_msg);
    }
}
