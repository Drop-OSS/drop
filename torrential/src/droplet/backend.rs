use std::{
    path::Path,
    sync::Arc,
};

use anyhow::anyhow;
use droplet_rs::versions::types::VersionBackend;
use protobuf::Message;

use crate::{
    proto::{
        core::{DropBoundType, TorrentialBound},
        droplet::{
            HasBackendQuery, HasBackendResponse, ListFilesQuery, ListFilesResponse, PeekFileQuery,
            PeekFileResponse,
        },
    },
    server::DropServer,
};

pub async fn has_backend_rpc(
    server: Arc<DropServer>,
    message: TorrentialBound,
) -> Result<(), anyhow::Error> {
    let has_backend = HasBackendQuery::parse_from_bytes(&message.data)?;

    let has_backend = {
        let path = Path::new(&has_backend.path);
        let backend_constructor = droplet_rs::versions::create_backend_constructor(path);

        backend_constructor.is_some()
    };

    let mut response = HasBackendResponse::new();
    response.result = has_backend;

    server
        .send_message(
            DropBoundType::HAS_BACKEND_COMPLETE,
            response,
            Some(message.message_id),
        )
        .await?;

    Ok(())
}

fn create_backend(path: &String) -> Result<Box<dyn VersionBackend + Send + Sync>, anyhow::Error> {
    let backend_constructor = droplet_rs::versions::create_backend_constructor(Path::new(path))
        .ok_or(anyhow!("backend doesn't exist at path {path}"))?;
    let backend = backend_constructor()?;

    Ok(backend)
}

pub async fn list_files_rpc(
    server: Arc<DropServer>,
    message: TorrentialBound,
) -> Result<(), anyhow::Error> {
    let query = ListFilesQuery::parse_from_bytes(&message.data)?;

    let mut backend = create_backend(&query.path)?;

    let files = backend.list_files().await?;

    let mut response = ListFilesResponse::new();
    response.files = files.into_iter().map(|v| v.relative_filename).collect();

    server
        .send_message(
            DropBoundType::LIST_FILES_COMPLETE,
            response,
            Some(message.message_id),
        )
        .await?;

    Ok(())
}

pub async fn peek_file_rpc(
    server: Arc<DropServer>,
    message: TorrentialBound,
) -> Result<(), anyhow::Error> {
    let query = PeekFileQuery::parse_from_bytes(&message.data)?;

    let mut backend = create_backend(&query.path)?;
    let file_peek = backend.peek_file(query.filename).await?;

    let mut response = PeekFileResponse::new();
    response.size = file_peek.size;

    server
        .send_message(
            DropBoundType::PEEK_FILE_COMPLETE,
            response,
            Some(message.message_id),
        )
        .await?;

    Ok(())
}
