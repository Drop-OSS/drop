use std::{
    env::set_current_dir,
    sync::Arc,
    time::{Duration, Instant},
};

use axum::{
    Router,
    routing::{get, post},
};
use dashmap::DashMap;
use log::info;
use simple_logger::SimpleLogger;
use tokio::{runtime::Handle, spawn, time};
use torrential::{
    downloads::{handlers, serve},
    server::create_drop_server,
    state::AppState,
};

const CONTEXT_TTL: u64 = 10 * 60;

#[tokio::main]
async fn main() {
    initialise_logger();

    if let Ok(working_directory) = std::env::var("WORKING_DIRECTORY") {
        info!("moving to working directory {working_directory}");
        set_current_dir(working_directory).expect("failed to change working directory");
    }

    let metrics = Handle::current().metrics();
    info!("using {} threads", metrics.num_workers());

    let server = create_drop_server()
        .await
        .expect("failed to connect to drop server");

    let shared_state = Arc::new(AppState {
        context_cache: DashMap::new(),
        server,
    });

    let interval_shared_state = shared_state.clone();

    spawn(async move {
        let shared_state = interval_shared_state;
        let mut interval = time::interval(Duration::from_mins(1));

        loop {
            interval.tick().await;
            let keys = shared_state
                .context_cache
                .iter()
                .map(|v| v.key().clone())
                .collect::<Vec<(String, String)>>();
            for key in keys {
                let last_access = if let Some(context) = shared_state.context_cache.get(&key) {
                    context.last_access()
                } else {
                    Instant::now()
                };
                if last_access.elapsed().as_secs() >= CONTEXT_TTL {
                    shared_state.context_cache.remove(&key);
                    info!("cleaned context: {key:?}");
                }
            }
        }
    });

    let app = setup_app(shared_state);

    serve(app).await.expect("failed to serve app");
}

fn setup_app(shared_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/v1/depot/content/{game_id}/{version_name}/{chunk_id}",
            get(serve::serve_file),
        )
        .route("/api/v1/depot/manifest.json", get(handlers::manifest))
        .route("/api/v1/depot/speedtest", get(handlers::speedtest))
        .route("/healthcheck", get(handlers::healthcheck))
        .route("/invalidate", post(handlers::invalidate))
        .with_state(shared_state)
}

async fn serve(app: Router) -> Result<(), std::io::Error> {
    let listener = tokio::net::TcpListener::bind("0.0.0.0:5000")
        .await
        .expect("failed to bind tcp server");
    info!("started depot server");
    axum::serve(listener, app).await
}

fn initialise_logger() {
    SimpleLogger::new()
        .with_level(log::LevelFilter::Info)
        .init()
        .expect("failed to init logger");
}
