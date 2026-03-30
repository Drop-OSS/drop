use std::{
    io::Error,
    sync::{Arc, LazyLock},
};

use aes::cipher::{KeyIvInit, StreamCipher};
use axum::{
    body::Body,
    extract::{Path, State},
    http::HeaderMap,
    response::IntoResponse,
};
use bytes::Bytes;
use dashmap::{DashMap, mapref::one::RefMut};
use droplet_rs::{
    manifest::ChunkData,
    versions::types::{MinimumFileObject, VersionFile},
};
use futures_util::{Stream, StreamExt, stream};
use log::{error, info};
use pin_project_lite::pin_project;
use reqwest::StatusCode;
use tokio::sync::{Semaphore, SemaphorePermit};
use tokio_util::io::ReaderStream;

use crate::{
    DownloadContext, GLOBAL_CONTEXT_SEMAPHORE, downloads::download::create_download_context,
    state::AppState,
};

type Aes128Ctr64LE = ctr::Ctr64LE<aes::Aes128>;

pin_project! {
    struct SemaphoreStream<'a, T>
        where T: Stream
    {
        #[pin]
        stream: T,
        semaphore: SemaphorePermit<'a>,
    }
}

impl<'a, T: Stream> SemaphoreStream<'a, T> {
    fn new(stream: T, permit: SemaphorePermit<'a>) -> Self {
        Self {
            stream,
            semaphore: permit,
        }
    }
}

impl<T: Stream> Stream for SemaphoreStream<'_, T>
where
    T: Stream,
{
    type Item = T::Item;

    fn poll_next(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<Self::Item>> {
        let this = self.project();
        this.stream.poll_next(cx)
    }
}

static SEMPAHORE_COUNT: LazyLock<usize> =
    LazyLock::new(|| file_open_limit::get().expect("failed to count max open files"));
static FILE_SEMAPHORE: LazyLock<Semaphore> = LazyLock::new(|| Semaphore::new(*SEMPAHORE_COUNT));

pub async fn serve_file(
    State(state): State<Arc<AppState>>,
    Path((game_id, version_name, chunk_id)): Path<(String, String, String)>,
) -> Result<impl IntoResponse, StatusCode> {
    let context_cache = &state.context_cache;

    let mut context = get_or_create_context(&state, context_cache, game_id, version_name).await?;
    context.reset_last_access();

    let chunk_data = lookup_chunk(&chunk_id, &context)?;
    if chunk_data.files.len() >= *SEMPAHORE_COUNT {
        return Err(StatusCode::INSUFFICIENT_STORAGE);
    }
    let permit = FILE_SEMAPHORE
        .acquire_many(chunk_data.files.len().try_into().unwrap())
        .await
        .map_err(|_| StatusCode::INSUFFICIENT_STORAGE)?;
    let mut streams = Vec::with_capacity(chunk_data.files.len());
    let mut content_length = 0;

    for file_entry in &chunk_data.files {
        let reader = get_file_reader(
            &mut context,
            file_entry.filename.clone(),
            file_entry.start,
            file_entry.start + file_entry.length,
        )
        .await?;

        let stream = ReaderStream::new(reader);
        streams.push(stream);
        content_length += file_entry.length;
    }

    let stream = stream::iter(streams).flatten();
    let mut cipher = Aes128Ctr64LE::new(&context.manifest.key.into(), &chunk_data.iv.into());
    let encrypted_stream = stream.chunks(16).map(move |raw| -> Result<Bytes, Error> {
        let data: Result<Vec<Bytes>, Error> = raw.into_iter().collect();
        let mut data = data?.concat();

        cipher.apply_keystream(&mut data);

        Ok(data.into())
    });
    let permit_stream = SemaphoreStream::new(encrypted_stream, permit);
    let body: Body = Body::from_stream(permit_stream);

    let mut headers = HeaderMap::new();
    headers.insert("Content-Type", "application/octet-stream".parse().unwrap());
    headers.insert("Content-Length", content_length.into());

    Ok((headers, body))
}
async fn acquire_permit<'a>() -> SemaphorePermit<'a> {
    return GLOBAL_CONTEXT_SEMAPHORE
        .acquire()
        .await
        .expect("failed to acquire semaphore");
}
/**
 * Needs to be cloned for reference reasons
 */
fn lookup_chunk(
    chunk_id: &str,
    context: &RefMut<'_, (String, String), DownloadContext>,
) -> Result<ChunkData, StatusCode> {
    context
        .manifest
        .chunks
        .get(chunk_id)
        .cloned()
        .ok_or(StatusCode::NOT_FOUND)
}
async fn get_file_reader(
    context: &mut RefMut<'_, (String, String), DownloadContext>,
    relative_filename: String,
    start: usize,
    end: usize,
) -> Result<Box<dyn MinimumFileObject>, StatusCode> {
    context
        .backend
        .reader(
            &VersionFile {
                relative_filename: relative_filename.clone(),
                permission: 0,
                size: 0,
            },
            start as u64,
            end as u64,
        )
        .await
        .map_err(|v| {
            error!("reader error for '{relative_filename}': {v:?}");
            StatusCode::INTERNAL_SERVER_ERROR
        })
}
async fn get_or_create_context<'a>(
    state: &Arc<AppState>,
    context_cache: &'a DashMap<(String, String), DownloadContext>,
    game_id: String,
    version_name: String,
) -> Result<RefMut<'a, (String, String), DownloadContext>, StatusCode> {
    let key = (game_id.clone(), version_name.clone());

    if let Some(context) = context_cache.get_mut(&key) {
        Ok(context)
    } else {
        let permit = acquire_permit().await;

        // Check if it's been done while we've been sitting here
        if let Some(already_done) = context_cache.get_mut(&key) {
            Ok(already_done)
        } else {
            info!("generating context for {game_id}...");
            let context_result =
                create_download_context(state, game_id.clone(), version_name.clone()).await?;

            state.context_cache.insert(key.clone(), context_result);

            info!("continuing download for {game_id}");

            drop(permit);

            Ok(context_cache.get_mut(&key).unwrap())
        }
    }
}
