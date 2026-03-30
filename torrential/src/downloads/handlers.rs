use std::{
    collections::HashMap,
    sync::Arc,
    task::Poll,
};

use axum::{
    Json,
    body::Body,
    extract::State,
    http::{HeaderMap, HeaderValue},
    response::IntoResponse,
};
use bytes::BufMut;
use reqwest::{StatusCode, header::CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::Write;
use tokio::io::AsyncRead;
use tokio_util::io::ReaderStream;

use crate::{server::download::fetch_instance_games, state::AppState};

pub async fn healthcheck() -> StatusCode {
    StatusCode::OK
}

#[derive(Deserialize)]
pub struct InvalidateBody {
    game: String,
    version: String,
}

pub async fn invalidate(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<InvalidateBody>,
) -> StatusCode {
    state.context_cache.remove(&(payload.game, payload.version));
    StatusCode::OK
}

struct SpeedtestStream {
    remaining: usize,
}

impl SpeedtestStream {
    pub fn new() -> Self {
        SpeedtestStream {
            remaining: 1024 * 1024 * 50,
        }
    }
    fn content_length(&self) -> usize {
        self.remaining
    }
}
const ZERO: [u8; 1024] = [0u8; _];
impl AsyncRead for SpeedtestStream {
    fn poll_read(
        mut self: std::pin::Pin<&mut Self>,
        _cx: &mut std::task::Context<'_>,
        buf: &mut tokio::io::ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        if self.remaining > 0 {
            let mut writer = buf.writer();

            let amount = writer.write(&ZERO);
            match amount {
                Ok(amount) => self.remaining -= amount,
                Err(err) => return Poll::Ready(Err(err)),
            }
        }
        Poll::Ready(Ok(()))
    }
}

pub async fn speedtest() -> Result<impl IntoResponse, StatusCode> {
    let speedtest = SpeedtestStream::new();
    let ct = speedtest.content_length();
    let speedtest_stream = ReaderStream::new(speedtest);
    let body = Body::from_stream(speedtest_stream);

    let mut headers = HeaderMap::new();
    headers.insert("Content-Type", "application/octet-stream".parse().unwrap());
    headers.insert("Content-Length", ct.into());

    Ok((headers, body))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GameData {
    version_id: String,
    compression: String,
}

#[derive(Serialize)]
struct Manifest {
    content: HashMap<String, Vec<GameData>>,
}

pub async fn manifest(State(state): State<Arc<AppState>>) -> Result<impl IntoResponse, StatusCode> {
    let games = fetch_instance_games(&state).await?;

    let mut content = HashMap::new();
    for game in games {
        content.insert(
            game.id,
            game.versions
                .into_iter()
                .map(|v| GameData {
                    version_id: v.version_id,
                    compression: "none".to_owned(),
                })
                .collect::<Vec<GameData>>(),
        );
    }

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    Ok((headers, json!(Manifest { content }).to_string()))
}
