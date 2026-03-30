use crate::{
    proto::{
        core::DropBoundType,
        manifest::{ServerGamesQuery, ServerGamesResponse, server_games_response::SkeletonGame},
        version::{VersionQuery, VersionResponse},
    },
    state::AppState,
    util::ErrorOption,
};

pub async fn fetch_version_data(
    app_state: &AppState,
    _game_id: String,
    version_id: String,
) -> Result<VersionResponse, ErrorOption> {
    let mut query = VersionQuery::new();
    query.version_id = version_id;
    let message_id = app_state
        .server
        .send_message(DropBoundType::VERSION_QUERY, query, None)
        .await?;

    let response: VersionResponse = app_state.server.wait_for_message_id(&message_id).await?;

    Ok(response)
}

pub async fn fetch_instance_games(app_state: &AppState) -> Result<Vec<SkeletonGame>, ErrorOption> {
    let message_id = app_state
        .server
        .send_message(DropBoundType::SERVER_GAMES_QUERY, ServerGamesQuery::new(), None)
        .await?;

    let response: ServerGamesResponse = app_state.server.wait_for_message_id(&message_id).await?;

    Ok(response.games)
}
