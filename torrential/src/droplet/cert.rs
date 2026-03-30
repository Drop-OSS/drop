use std::sync::Arc;

use anyhow::anyhow;
use protobuf::Message as _;

use crate::{
    proto::{
        core::{DropBoundType, TorrentialBound},
        droplet::{ClientCertQuery, ClientCertResponse, RootCertResponse},
    },
    server::DropServer,
};

pub async fn generate_root_ca_rpc(
    server: Arc<DropServer>,
    message: TorrentialBound,
) -> Result<(), anyhow::Error> {
    let manifest = droplet_rs::ssl::generate_root_ca()?;
    let mut manifest = manifest.into_iter();

    let mut root_ca = RootCertResponse::new();
    root_ca.cert = manifest
        .next()
        .ok_or(anyhow!("root ca generation missing cert"))?;
    root_ca.priv_ = manifest
        .next()
        .ok_or(anyhow!("root ca generation missing priv"))?;

    server
        .send_message(
            DropBoundType::ROOT_CA_COMPLETE,
            root_ca,
            Some(message.message_id),
        )
        .await?;

    Ok(())
}

pub async fn generate_client_cert_rpc(
    server: Arc<DropServer>,
    message: TorrentialBound,
) -> Result<(), anyhow::Error> {
    let generate_message = ClientCertQuery::parse_from_bytes(&message.data)?;

    let cert = droplet_rs::ssl::generate_client_certificate(
        generate_message.client_id,
        generate_message.client_name,
        generate_message.root_cert,
        generate_message.root_priv,
    )?;
    let mut cert = cert.into_iter();

    let mut client_cert = ClientCertResponse::new();
    client_cert.cert = cert
        .next()
        .ok_or(anyhow!("client cert generation missing cert"))?;
    client_cert.priv_ = cert
        .next()
        .ok_or(anyhow!("client cert generation missing priv"))?;

    server
        .send_message(
            DropBoundType::CLIENT_CERT_COMPLETE,
            client_cert,
            Some(message.message_id),
        )
        .await?;

    Ok(())
}
