//! The HTTP half of cloud saves: exactly the contract proven by
//! `server/e2e/saves-http.e2e.ts`.
//!
//! Auth is the client JWT (`Authorization: JWT <clientId> <token>`) the whole
//! desktop uses; everything else is save-specific headers: `If-Match` for
//! optimistic concurrency, `Idempotency-Key` for replay-safe uploads, and the
//! identity headers on uploads/downloads.

use std::fmt;

use reqwest::header::HeaderMap;
use serde::{Deserialize, Serialize};
use url::Url;

use crate::error::SaveError;
use crate::manifest::{ManifestResponse, SaveManifest};

const API_ROOT: &str = "api/v1/client/saves";

/// The server's serialized `SaveVersion` (`toSaveVersionDto` in
/// `server/internal/saves/index.ts`) - field names must track that function.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveVersion {
    pub id: String,
    pub content_hash: Option<String>,
    pub archive_sha256: Option<String>,
    // Nullable on the server for legacy-backfilled versions.
    pub size_bytes: Option<i64>,
    pub file_count: Option<i64>,
    pub kind: String,
    pub pinned: bool,
    pub restored_from_version_id: Option<String>,
    /// ISO timestamp as h3 serializes `Date`.
    pub created_at: String,
}

/// `GET .../{gameId}/{slot}` response (`toSaveSlotDto`), pruned to what the
/// device reasons about.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSlot {
    pub head: Option<SaveVersion>,
    pub version_count: i64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SyncDecision {
    Noop,
    Push,
    Pull,
    Converged,
    Conflict,
}

impl fmt::Display for SyncDecision {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            SyncDecision::Noop => "noop",
            SyncDecision::Push => "push",
            SyncDecision::Pull => "pull",
            SyncDecision::Converged => "converged",
            SyncDecision::Conflict => "conflict",
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncState {
    pub decision: SyncDecision,
    pub base_content_hash: Option<String>,
    pub head: Option<SaveVersion>,
}

/// Outcome of a head-moving call (upload or restore) - `Conflict` is an
/// answer, not a failure.
#[derive(Debug)]
pub enum MutationOutcome {
    Stored(SaveVersion),
    /// Our `If-Match` baseline is stale; the server named the real head.
    Conflict {
        head_version_id: Option<String>,
    },
}

/// A save API handle. Production uses the shared desktop client (its rustls
/// trust store knows the self-hosted server's certificate, and its middleware
/// maintains online state); tests inject a plain client with a dummy header.
#[derive(Clone)]
pub struct SaveClient {
    base: Url,
    client: HttpClient,
    auth_header: fn() -> String,
}

#[derive(Clone)]
enum HttpClient {
    Shared,
    Plain(reqwest::Client),
}

enum RequestBuilder {
    Shared(reqwest_middleware::RequestBuilder),
    Plain(reqwest::RequestBuilder),
}

impl RequestBuilder {
    fn header(self, name: &str, value: &str) -> Result<Self, SaveError> {
        let value = reqwest::header::HeaderValue::from_str(value)
            .map_err(|e| SaveError::Path(format!("cannot send header {name}: {e}")))?;
        Ok(match self {
            Self::Shared(b) => Self::Shared(b.header(name, value)),
            Self::Plain(b) => Self::Plain(b.header(name, value)),
        })
    }

    fn body(self, body: impl Into<reqwest::Body>) -> Self {
        match self {
            Self::Shared(b) => Self::Shared(b.body(body)),
            Self::Plain(b) => Self::Plain(b.body(body)),
        }
    }

    fn json(self, body: &serde_json::Value) -> Self {
        match self {
            Self::Shared(b) => Self::Shared(b.json(body)),
            Self::Plain(b) => Self::Plain(b.json(body)),
        }
    }

    async fn send(self) -> Result<reqwest::Response, SaveError> {
        match self {
            Self::Shared(b) => b
                .send()
                .await
                .map_err(|e| SaveError::Io(std::io::Error::other(e))),
            Self::Plain(b) => b
                .send()
                .await
                .map_err(|e| SaveError::Io(std::io::Error::other(e))),
        }
    }
}

impl SaveClient {
    /// The production client: shared desktop HTTP stack + real auth.
    pub fn from_desktop() -> Result<SaveClient, SaveError> {
        Ok(SaveClient {
            base: database::DB.fetch_base_url(),
            client: HttpClient::Shared,
            auth_header: remote::auth::generate_authorization_header,
        })
    }

    /// A detached client for tests and tooling: plain reqwest, caller-supplied
    /// `Authorization` header (the mock does not verify it).
    pub fn detached(base: Url, auth_header: fn() -> String) -> SaveClient {
        SaveClient {
            base,
            client: HttpClient::Plain(
                reqwest::Client::builder()
                    .connect_timeout(std::time::Duration::from_secs(5))
                    .build()
                    .expect("reqwest client"),
            ),
            auth_header,
        }
    }

    fn request(
        &self,
        method: reqwest::Method,
        path: &str,
        query: &[(&str, &str)],
    ) -> Result<RequestBuilder, SaveError> {
        let mut url = self
            .base
            .join(&format!("{API_ROOT}/{path}"))
            .map_err(|e| SaveError::Path(format!("bad save url: {e}")))?;
        if !query.is_empty() {
            let mut pairs = url.query_pairs_mut();
            for (key, value) in query {
                pairs.append_pair(key, value);
            }
        }
        let request = match &self.client {
            HttpClient::Shared => RequestBuilder::Shared(
                remote::utils::DROP_CLIENT_ASYNC.request(method.clone(), url.clone()),
            ),
            HttpClient::Plain(client) => RequestBuilder::Plain(client.request(method, url)),
        };
        request.header("Authorization", &(self.auth_header)())
    }

    async fn respond(
        response: reqwest::Response,
        context: &str,
    ) -> Result<reqwest::Response, SaveError> {
        let status = response.status();
        if status.is_success() {
            return Ok(response);
        }
        // The server answers errors as h3 payloads: { message, statusCode,
        // statusMessage, data? }.
        let body: serde_json::Value = response
            .json()
            .await
            .unwrap_or_else(|_| serde_json::json!({}));
        let message = body
            .get("message")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("unknown error")
            .to_string();
        Err(SaveError::Http {
            status: status.as_u16(),
            message: format!("{context}: {message}"),
        })
    }

    /// `GET .../manifests/{gameId}`; `None` means the game has no curated
    /// manifest and cloud saves do not apply to it.
    pub async fn manifest(&self, game_id: &str) -> Result<Option<SaveManifest>, SaveError> {
        let request = self.request(reqwest::Method::GET, &format!("manifests/{game_id}"), &[])?;
        let response = request.send().await;
        let response = match response {
            Ok(r) if r.status() == reqwest::StatusCode::NOT_FOUND => return Ok(None),
            Ok(r) => r,
            Err(e) => return Err(e),
        };
        let response = Self::respond(response, "fetch save manifest").await?;
        let raw: ManifestResponse = response.json().await?;
        Ok(Some(SaveManifest::from_response(&raw)?))
    }

    /// `GET .../{gameId}/{slot}/sync` - the clock-free sync decision.
    pub async fn sync(
        &self,
        game_id: &str,
        slot: u32,
        base_version_id: Option<&str>,
        local_content_hash: Option<&str>,
    ) -> Result<SyncState, SaveError> {
        let mut query: Vec<(&str, &str)> = Vec::new();
        if let Some(base) = base_version_id {
            query.push(("baseVersionId", base));
        }
        if let Some(hash) = local_content_hash {
            query.push(("localContentHash", hash));
        }
        let request = self.request(
            reqwest::Method::GET,
            &format!("{game_id}/{slot}/sync"),
            &query,
        )?;
        let response = Self::respond(request.send().await?, "fetch sync state").await?;
        Ok(response.json().await?)
    }

    /// `POST .../{gameId}/{slot}/versions` with the raw archive as the body.
    #[allow(clippy::too_many_arguments)]
    pub async fn upload(
        &self,
        game_id: &str,
        slot: u32,
        bytes: Vec<u8>,
        base_version_id: Option<&str>,
        idempotency_key: &str,
        content_hash: &str,
        archive_sha256: &str,
        file_count: usize,
        manifest_hash: &str,
    ) -> Result<MutationOutcome, SaveError> {
        let mut request = self.request(
            reqwest::Method::POST,
            &format!("{game_id}/{slot}/versions"),
            &[],
        )?;
        for (name, value) in [
            ("Idempotency-Key", idempotency_key),
            ("X-Content-Hash", content_hash),
            ("X-Archive-Sha256", archive_sha256),
            ("X-Manifest-Hash", manifest_hash),
        ] {
            request = request.header(name, value)?;
        }
        request = request
            .header("X-File-Count", &file_count.to_string())?
            .header("Content-Type", "application/zstd")?;
        if let Some(base) = base_version_id {
            request = request.header("If-Match", base)?;
        }
        let response = request.body(bytes).send().await?;
        if response.status() == reqwest::StatusCode::CONFLICT {
            let body: serde_json::Value = response
                .json()
                .await
                .unwrap_or_else(|_| serde_json::json!({}));
            let head = body
                .get("data")
                .and_then(|data| data.get("headVersionId"))
                .and_then(serde_json::Value::as_str)
                .map(str::to_string);
            return Ok(MutationOutcome::Conflict {
                head_version_id: head,
            });
        }
        let response = Self::respond(response, "upload save version").await?;
        Ok(MutationOutcome::Stored(response.json().await?))
    }

    /// `GET .../{gameId}/{slot}/versions/{versionId}/download` -> archive
    /// bytes. The caller verifies `expected_archive_sha256`.
    pub async fn download(
        &self,
        game_id: &str,
        slot: u32,
        version_id: &str,
    ) -> Result<(Vec<u8>, HeaderMap), SaveError> {
        let request = self.request(
            reqwest::Method::GET,
            &format!("{game_id}/{slot}/versions/{version_id}/download"),
            &[],
        )?;
        let response = Self::respond(request.send().await?, "download save version").await?;
        let headers = response.headers().clone();
        let bytes = response.bytes().await?;
        Ok((bytes.to_vec(), headers))
    }

    /// `GET .../{gameId}/{slot}` - the slot with its current head. `None`
    /// when the slot does not exist (nothing has ever synced).
    pub async fn slot(&self, game_id: &str, slot: u32) -> Result<Option<SaveSlot>, SaveError> {
        let response = self
            .request(reqwest::Method::GET, &format!("{game_id}/{slot}"), &[])?
            .send()
            .await?;
        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }
        let response = Self::respond(response, "fetch save slot").await?;
        Ok(Some(response.json().await?))
    }

    /// `GET .../{gameId}/{slot}/versions` - newest first; the last element's
    /// `id` is the cursor for the next page.
    pub async fn list_versions(
        &self,
        game_id: &str,
        slot: u32,
        cursor: Option<&str>,
        limit: Option<usize>,
    ) -> Result<Vec<SaveVersion>, SaveError> {
        let limit_text;
        let mut query: Vec<(&str, &str)> = Vec::new();
        if let Some(cursor) = cursor {
            query.push(("cursor", cursor));
        }
        if let Some(limit) = limit {
            limit_text = limit.to_string();
            query.push(("limit", &limit_text));
        }
        let response = self
            .request(
                reqwest::Method::GET,
                &format!("{game_id}/{slot}/versions"),
                &query,
            )?
            .send()
            .await?;
        // No slot yet (nothing ever synced) is an empty timeline, not an error.
        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(Vec::new());
        }
        let response = Self::respond(response, "list save versions").await?;
        Ok(response.json().await?)
    }

    /// `POST .../versions/{versionId}/restore` - publish `versionId`'s content
    /// as a brand-new head. Never rewrites history.
    pub async fn restore(
        &self,
        game_id: &str,
        slot: u32,
        version_id: &str,
        base_version_id: Option<&str>,
    ) -> Result<MutationOutcome, SaveError> {
        let mut request = self.request(
            reqwest::Method::POST,
            &format!("{game_id}/{slot}/versions/{version_id}/restore"),
            &[],
        )?;
        if let Some(base) = base_version_id {
            request = request.header("If-Match", base)?;
        }
        let response = request.send().await?;
        if response.status() == reqwest::StatusCode::CONFLICT {
            let body: serde_json::Value = response
                .json()
                .await
                .unwrap_or_else(|_| serde_json::json!({}));
            let head = body
                .get("data")
                .and_then(|data| data.get("headVersionId"))
                .and_then(serde_json::Value::as_str)
                .map(str::to_string);
            return Ok(MutationOutcome::Conflict {
                head_version_id: head,
            });
        }
        let response = Self::respond(response, "restore save version").await?;
        Ok(MutationOutcome::Stored(response.json().await?))
    }

    /// `POST .../versions/{versionId}/pin` - protected versions are never
    /// pruned by retention.
    pub async fn set_pinned(
        &self,
        game_id: &str,
        slot: u32,
        version_id: &str,
        pinned: bool,
    ) -> Result<SaveVersion, SaveError> {
        let response = self
            .request(
                reqwest::Method::POST,
                &format!("{game_id}/{slot}/versions/{version_id}/pin"),
                &[],
            )?
            .json(&serde_json::json!({ "pinned": pinned }))
            .send()
            .await?;
        let response = Self::respond(response, "pin save version").await?;
        Ok(response.json().await?)
    }
}
