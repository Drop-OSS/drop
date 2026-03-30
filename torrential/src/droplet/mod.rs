use std::sync::Arc;

use log::warn;

use crate::{proto::{core::{DropBoundType, TorrentialBound}, droplet::RpcError}, server::DropServer};

pub mod cert;
pub mod manifest;
pub mod backend;

pub async fn call_rpc<T>(server: Arc<DropServer>, message: TorrentialBound, rpc: T)
where
    T: AsyncFn(Arc<DropServer>, TorrentialBound) -> Result<(), anyhow::Error>,
{
    let message_id = message.message_id.clone();
    let message_type = message.type_.enum_value().unwrap();
    let result = rpc(server.clone(), message).await;
    if let Err(err) = result {
        warn!("rpc call for {message_type:?} failed with error: {err:?}");
        let mut manifest_err = RpcError::new();
        manifest_err.error = err.to_string();
        let _ = server
            .send_message(
                DropBoundType::RPC_ERROR,
                manifest_err,
                Some(message_id),
            )
            .await
            .inspect_err(|err| {
                warn!("failed to send manifest err: {err:?}");
            });
    }
}
