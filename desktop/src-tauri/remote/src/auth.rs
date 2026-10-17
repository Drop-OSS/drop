use std::{
    collections::HashMap,
    env,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use client::{app_status::AppStatus, user::User};
use database::{DatabaseAuth, interface::borrow_db_checked};
use gethostname::gethostname;
use jsonwebtoken::{Algorithm, EncodingKey, Header};
use log::{error, warn};
use serde::{Deserialize, Serialize};
use url::Url;

use crate::{
    error::{DropServerError, RemoteAccessError},
    requests::make_authenticated_get,
    utils::DROP_CLIENT_SYNC,
};

use super::{
    cache::{cache_object, get_cached_object},
    requests::generate_url,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CapabilityConfiguration {}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InitiateRequestBody {
    name: String,
    platform: String,
    capabilities: HashMap<String, CapabilityConfiguration>,
    mode: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HandshakeRequestBody {
    client_id: String,
    token: String,
}

impl HandshakeRequestBody {
    pub fn new(client_id: String, token: String) -> Self {
        Self { client_id, token }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HandshakeResponse {
    private: String,
    certificate: String,
    id: String,
}

impl From<HandshakeResponse> for DatabaseAuth {
    fn from(value: HandshakeResponse) -> Self {
        DatabaseAuth::new(value.private, value.certificate, value.id, None)
    }
}

#[derive(Serialize, Deserialize)]
struct Claims {
    exp: usize,
    nbf: usize,
}

pub fn generate_authorization_header() -> String {
    let certs = {
        let db = borrow_db_checked();
        db.auth.clone().expect("Authorisation not initialised")
    };

    let system_time: usize = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0))
        .as_secs() as usize;

    let claims = Claims {
        nbf: system_time,
        exp: system_time + 10,
    };

    let jwt = jsonwebtoken::encode(
        &Header::new(Algorithm::ES384),
        &claims,
        &EncodingKey::from_ec_pem(certs.private.as_bytes()).unwrap(),
    )
    .expect("failed to sign jwt");

    format!("JWT {} {}", certs.client_id, jwt)
}

pub async fn fetch_user() -> Result<User, RemoteAccessError> {
    let response = make_authenticated_get(generate_url(&["/api/v1/client/user"], &[])?).await?;
    if response.status() != 200 {
        let err: DropServerError = response.json().await?;
        warn!("{err:?}");

        if err.message == "Nonce expired" {
            return Err(RemoteAccessError::OutOfSync);
        }

        return Err(RemoteAccessError::InvalidResponse(err));
    }

    response
        .json::<User>()
        .await
        .map_err(std::convert::Into::into)
}

pub fn auth_initiate_logic(mode: String) -> Result<String, RemoteAccessError> {
    let base_url = {
        let db_lock = borrow_db_checked();
        Url::parse(&db_lock.base_url.clone())?
    };

    let hostname = gethostname();

    let endpoint = base_url.join("/api/v1/client/auth/initiate")?;
    let body = InitiateRequestBody {
        name: format!("{} (Desktop)", hostname.display()),
        platform: env::consts::OS.to_string(),
        capabilities: HashMap::from([
            ("peerAPI".to_owned(), CapabilityConfiguration {}),
            ("cloudSaves".to_owned(), CapabilityConfiguration {}),
            ("trackPlaytime".to_owned(), CapabilityConfiguration {}),
        ]),
        mode,
    };

    let client = DROP_CLIENT_SYNC.clone();
    let response = client.post(endpoint.to_string()).json(&body).send()?;

    if response.status() != 200 {
        let data: DropServerError = response.json()?;
        error!("could not start handshake: {:?}", data);

        return Err(RemoteAccessError::HandshakeFailed(data.message));
    }

    let response = response.text()?;

    Ok(response)
}

pub async fn setup() -> (AppStatus, Option<User>) {
    let auth = {
        let data = borrow_db_checked();
        data.auth.clone()
    };

    if auth.is_some() {
        let user_result = match fetch_user().await {
            Ok(data) => data,
            Err(RemoteAccessError::FetchError(_)) => {
                let user = get_cached_object::<User>("user").ok();
                return (AppStatus::Offline, user);
            }
            Err(_) => return (AppStatus::SignedInNeedsReauth, None),
        };
        if let Err(e) = cache_object("user", &user_result) {
            warn!("Could not cache user object with error {e}");
        }
        return (AppStatus::SignedIn, Some(user_result));
    }

    (AppStatus::SignedOut, None)
}
