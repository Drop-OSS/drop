use database::borrow_db_checked;
use http::{
    HeaderMap, HeaderValue, Request, Response, StatusCode, Uri,
    header::{CONTENT_SECURITY_POLICY, USER_AGENT, X_FRAME_OPTIONS},
};
use log::{error, warn};
use tauri::UriSchemeResponder;

use crate::utils::DROP_CLIENT_ASYNC;

pub async fn handle_server_proto_offline_wrapper(
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    responder.respond(match handle_server_proto_offline(request).await {
        Ok(res) => res,
        Err(_) => unreachable!(),
    });
}

pub async fn handle_server_proto_offline(
    _request: Request<Vec<u8>>,
) -> Result<Response<Vec<u8>>, StatusCode> {
    Ok(Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Vec::new())
        .expect("Failed to build error response for proto offline"))
}

pub async fn handle_server_proto_wrapper(request: Request<Vec<u8>>, responder: UriSchemeResponder) {
    match handle_server_proto(request).await {
        Ok(r) => responder.respond(r),
        Err(e) => {
            warn!("server proto error: {e}");
            responder.respond(
                Response::builder()
                    .status(e)
                    .body(Vec::new())
                    .inspect_err(|v| warn!("{:?}", v))
                    .expect("Failed to build error response"),
            );
        }
    }
}

async fn handle_server_proto(request: Request<Vec<u8>>) -> Result<Response<Vec<u8>>, StatusCode> {
    let (remote_uri, web_token) = {
        let db_handle = borrow_db_checked();
        let auth = match db_handle.auth.as_ref() {
            Some(auth) => auth,
            None => {
                error!("Could not find auth in database");
                return Err(StatusCode::UNAUTHORIZED);
            }
        };
        let web_token = match &auth.web_token {
            Some(token) => token.clone(),
            None => return Err(StatusCode::UNAUTHORIZED),
        };
        let remote_uri = db_handle
            .base_url
            .parse::<Uri>()
            .inspect_err(|v| warn!("{:?}", v))
            .expect("Failed to parse base url");
        (remote_uri, web_token)
    };

    let mut new_uri = request.uri().clone().into_parts();
    new_uri.authority = remote_uri.authority().cloned();
    new_uri.scheme = remote_uri.scheme().cloned();
    let err_msg = &format!("Failed to build new uri from parts {new_uri:?}");
    let new_uri = Uri::from_parts(new_uri)
        .inspect_err(|v| warn!("{:?}", v))
        .expect(err_msg);

    let mut headers = HeaderMap::new();
    request.headers().clone_into(&mut headers);
    headers.remove(USER_AGENT);
    headers.append(USER_AGENT, HeaderValue::from_static("Drop Desktop Client"));
    headers.append(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {web_token}")).unwrap(),
    );

    let response = match DROP_CLIENT_ASYNC
        .request(request.method().clone(), new_uri.to_string())
        .headers(headers)
        .body(request.body().clone()) // PENDING: refactor this into a move
        .send()
        .await
    {
        Ok(response) => response,
        Err(e) => {
            warn!("Could not send response. Got {e:?} when sending");
            return Err(e.status().unwrap_or(StatusCode::BAD_REQUEST));
        }
    };

    let response_status = response.status();
    let mut client_http_response = Response::builder()
        .status(response_status)
        .header("Access-Control-Allow-Origin", "*");

    {
        let client_response_headers = client_http_response.headers_mut().unwrap();
        for (header, header_value) in response.headers() {
            if header == CONTENT_SECURITY_POLICY {
                continue;
            }
            if header == X_FRAME_OPTIONS {
                continue;
            }
            client_response_headers.insert(header, header_value.clone());
        }
    };

    let response_body = match response.bytes().await {
        Ok(bytes) => bytes,
        Err(e) => return Err(e.status().unwrap_or(StatusCode::INTERNAL_SERVER_ERROR)),
    };

    let client_http_response = client_http_response
        .body(response_body.to_vec())
        .inspect_err(|v| warn!("{:?}", v))
        .expect("Failed to build server proto response");

    Ok(client_http_response)
}
