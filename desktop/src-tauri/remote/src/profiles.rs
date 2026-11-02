//! The account's players (server-side profiles): list, add, rename.
//!
//! Which profile is *active* is local taste, stored on the `Database` and
//! attached to authenticated requests by `requests::profile_header`; this
//! module only manages the roster it picks from.

use serde::{Deserialize, Serialize};

use crate::error::{DropServerError, RemoteAccessError};
use crate::requests::{
    generate_url, make_authenticated_get, make_authenticated_patch, make_authenticated_post,
};

/// The server's `ProfileDto` (`server/internal/profiles`).
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProfileDto {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub created_at: String,
}

#[derive(Serialize)]
struct ProfileName<'a> {
    name: &'a str,
}

async fn decode<T: serde::de::DeserializeOwned>(
    response: reqwest::Response,
    what: &str,
) -> Result<T, RemoteAccessError> {
    if !response.status().is_success() {
        let error: DropServerError = response
            .json()
            .await
            .map_err(|e| RemoteAccessError::UnparseableResponse(format!("{what}: {e}")))?;
        return Err(RemoteAccessError::InvalidResponse(error));
    }
    response
        .json()
        .await
        .map_err(|e| RemoteAccessError::UnparseableResponse(format!("{what}: {e}")))
}

/// The account's profiles, default first.
pub async fn fetch_profiles() -> Result<Vec<ProfileDto>, RemoteAccessError> {
    let endpoint = generate_url(&["/api/v1/client/profiles"], &[])?;
    let response = make_authenticated_get(endpoint).await?;
    decode(response, "fetch profiles").await
}

/// Add a player to the account.
pub async fn create_profile(name: &str) -> Result<ProfileDto, RemoteAccessError> {
    let endpoint = generate_url(&["/api/v1/client/profiles"], &[])?;
    let response = make_authenticated_post(endpoint, &ProfileName { name }).await?;
    decode(response, "create profile").await
}

/// Rename a player. Their stats and saves ride through unchanged.
pub async fn rename_profile(id: &str, name: &str) -> Result<ProfileDto, RemoteAccessError> {
    let endpoint = generate_url(&["/api/v1/client/profiles", id], &[])?;
    let response = make_authenticated_patch(endpoint, &ProfileName { name }).await?;
    decode(response, "rename profile").await
}
