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
    /// Design-system colour key ("blue", "rose", ...).
    pub color: String,
    /// Object id of the player's identicon avatar, served through the same
    /// `object://` pipeline as game art. `None` on profiles that predate
    /// avatars and never changed colour - draw a fallback.
    pub avatar_object_id: Option<String>,
    pub created_at: String,
}

#[derive(Serialize)]
struct ProfilePatch<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    color: Option<&'a str>,
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

/// Add a player to the account (default colour; recolour afterwards).
pub async fn create_profile(name: &str) -> Result<ProfileDto, RemoteAccessError> {
    let endpoint = generate_url(&["/api/v1/client/profiles"], &[])?;
    let response = make_authenticated_post(
        endpoint,
        &ProfilePatch {
            name: Some(name),
            color: None,
        },
    )
    .await?;
    decode(response, "create profile").await
}

/// Rename a player. Their stats, saves and look ride through unchanged.
pub async fn rename_profile(id: &str, name: &str) -> Result<ProfileDto, RemoteAccessError> {
    let endpoint = generate_url(&["/api/v1/client/profiles", id], &[])?;
    let response = make_authenticated_patch(
        endpoint,
        &ProfilePatch {
            name: Some(name),
            color: None,
        },
    )
    .await?;
    decode(response, "rename profile").await
}

/// Give a player a new colour; the server regenerates their avatar to match.
pub async fn set_profile_color(id: &str, color: &str) -> Result<ProfileDto, RemoteAccessError> {
    let endpoint = generate_url(&["/api/v1/client/profiles", id], &[])?;
    let response = make_authenticated_patch(
        endpoint,
        &ProfilePatch {
            name: None,
            color: Some(color),
        },
    )
    .await?;
    decode(response, "set profile colour").await
}
