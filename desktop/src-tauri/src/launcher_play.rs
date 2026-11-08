//! Launcher play: running the copy the storefront owns.
//!
//! A game the player installed with a store launcher lives in the launcher's
//! folder, and the launcher keeps it current. Playing it from here means
//! running those same files in place, in the same prefix, with no second
//! copy. The depot's process manager is keyed to the install ledger - the
//! status, version and save machinery that a game Drop never installed has
//! no row in - so this path goes straight to the other half of a launch:
//! build the command the way the umu handlers build theirs, run it, and
//! report playtime when it ends.

use std::collections::HashMap;
use std::fs::{OpenOptions, create_dir_all};
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::nonpoison::Mutex;
use std::sync::{Arc, LazyLock};
use std::time::{Duration, SystemTime};

use database::{borrow_db_checked, db::DATA_ROOT_DIR};
use log::{info, warn};
use serde::Serialize;
use shared_child::SharedChild;
use tauri::{AppHandle, Emitter};

/// One install playing from its own folder, keyed by that folder. The
/// folder is the identity the detected list already carries; nothing here
/// needs the depot's game id, which only decides where playtime is filed.
pub static LAUNCHER_PROCESSES: LazyLock<Mutex<HashMap<String, Running>>> =
    LazyLock::new(Default::default);

/// What "playing" means for one row: a process tree this command owns and
/// waits on, or a Steam session the client owns - the handoff cannot watch
/// a process it did not spawn, so its session ends when Stop asks Steam to
/// end it, which is also the Steam client's own answer for stopping a game.
pub enum Running {
    Child(Arc<SharedChild>),
    #[cfg(target_os = "linux")]
    Steam {
        app_id: String,
        game_id: Option<String>,
        start: SystemTime,
    },
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PlayFinished {
    folder: String,
    game_id: Option<String>,
    seconds: u64,
}

/// A stable, filesystem-safe name for one install's prefix and logs.
fn slug_for(folder: &Path) -> String {
    let raw = folder
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let slug = raw
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();
    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() { "game".to_string() } else { slug }
}

/// Join the recipe's relative executable onto the folder, refusing anything
/// that is not plainly inside it - the same posture the import scan takes
/// toward paths a manifest cannot carry.
fn resolve_executable(folder: &Path, executable: &str) -> Result<PathBuf, String> {
    let rel = Path::new(executable);
    if rel.as_os_str().is_empty()
        || rel.is_absolute()
        || rel.components().any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err("the executable must be a path inside the game folder".into());
    }
    let abs = folder.join(rel);
    if !abs.is_file() {
        return Err(format!("{} is not a file", abs.display()));
    }
    Ok(abs)
}

/// The command that plays this install: the executable itself on Windows
/// (and any native target), or through umu-run + Proton on Linux - the same
/// invocation the depot's own Windows games get, except the prefix. A game
/// the storefront installed into a prefix runs in *that* prefix, because its
/// registry entries and service links were written there; only an install
/// found outside any prefix gets a fresh one of Drop's own.
fn build_command(
    exe: &Path,
    folder: &Path,
    prefix: Option<&str>,
    game_id: Option<&str>,
) -> Result<Command, String> {
    #[cfg(target_os = "linux")]
    {
        use ::client::compat::{COMPAT_INFO, UMU_LAUNCHER_EXECUTABLE};
        let umu = UMU_LAUNCHER_EXECUTABLE
            .as_ref()
            .ok_or("umu-run was not found on this machine")?;
        if COMPAT_INFO.as_ref().is_none_or(|c| !c.umu_installed) {
            return Err("umu is not installed, which playing a Windows game needs".into());
        }
        let proton_path = {
            let db = borrow_db_checked();
            db.applications.default_proton_path.clone().ok_or(
                "no default Proton is configured; choose one under Settings > Proton",
            )?
        };
        if !::process::compat::read_proton_path(PathBuf::from(&proton_path))
            .ok()
            .flatten()
            .is_some()
        {
            return Err(format!("{proton_path} is not a usable Proton build"));
        }
        let pfx = prefix
            .map(PathBuf::from)
            .unwrap_or_else(|| DATA_ROOT_DIR.join("pfx").join("launcher").join(slug_for(folder)));
        create_dir_all(&pfx).map_err(|e| e.to_string())?;

        let mut command = Command::new(umu);
        command
            .arg(exe)
            .current_dir(folder)
            .env("GAMEID", game_id.unwrap_or("umu-launcher-play"))
            .env("WINEPREFIX", &pfx)
            .env("PROTONPATH", &proton_path);
        Ok(command)
    }
    #[cfg(not(target_os = "linux"))]
    {
        // Windows runs the storefront's files natively; macOS only ever sees
        // a native build here anyway.
        let _ = (prefix, game_id);
        let mut command = Command::new(exe);
        command.current_dir(folder);
        Ok(command)
    }
}

/// Close the books on one play session: the UI event first, because it is
/// what frees the row, then the depot's own playtime rule - a run of two
/// seconds or less is a failed start, not a play session.
fn finish_play(app: &AppHandle, folder: &str, game_id: Option<String>, seconds: u64) {
    let _ = app.emit(
        "launcher_play_finished",
        PlayFinished {
            folder: folder.to_string(),
            game_id: game_id.clone(),
            seconds,
        },
    );
    if let Some(game_id) = game_id.filter(|_| seconds > 2) {
        tauri::async_runtime::spawn(async move {
            if let Err(e) = games::library::report_playtime(game_id.clone(), seconds).await {
                warn!("failed to report playtime for {game_id}: {e}");
            }
        });
    }
}

#[cfg(target_os = "linux")]
mod steam {
    use std::path::PathBuf;
    use std::process::Command;

    /// A Steam URI for one of the client's own actions: run and stop are the
    /// two this path uses, and they are the client's answers to Play and
    /// Stop, not ours improvised around it.
    pub fn steam_uri(action: &str, app_id: &str) -> String {
        format!("steam://{action}/{app_id}")
    }

    pub fn steam_command(uri: &str) -> Command {
        let mut command = Command::new("xdg-open");
        command.arg(uri);
        command
    }

    /// Whether this machine's native Steam client owns the app: the client's
    /// own install manifest for that id is presence said by the only source
    /// that matters, and it is a file - the same posture detection takes
    /// toward every storefront. Standard root and the two legacy spellings
    /// of it, because clients have moved and left links behind.
    pub fn native_owns_steam_app(app_id: &str) -> bool {
        let Some(home) = std::env::var_os("HOME").map(PathBuf::from) else {
            return false;
        };
        let manifest = format!("appmanifest_{app_id}.acf");
        [
            home.join(".local/share/Steam"),
            home.join(".steam/root"),
            home.join(".steam/steam"),
        ]
        .into_iter()
        .any(|root| root.join("steamapps").join(&manifest).is_file())
    }
}

/// Play a launcher-owned install in place.
///
/// `folder` and `executable` are what detection found (the UI may have
/// corrected them); `prefix` is the prefix the install was found in, if any;
/// `game_id` is the catalog game it matches, which is where the playtime of
/// a session goes; `steam_app_id` is a detected Steam app, which hands the
/// session to the native client when that client owns the game. Every
/// refusal is a plain message - the Play button shows it directly, and
/// nothing was started.
#[tauri::command]
pub async fn play_launcher_install(
    app: AppHandle,
    folder: String,
    executable: Option<String>,
    prefix: Option<String>,
    game_id: Option<String>,
    steam_app_id: Option<String>,
) -> Result<(), String> {
    let folder_path = PathBuf::from(&folder);
    if !folder_path.is_dir() {
        return Err("the game folder is not on this machine".into());
    }
    if LAUNCHER_PROCESSES.lock().contains_key(&folder) {
        return Err("this install is already running".into());
    }

    // A Steam build played by a client that is not up is a DRM refusal with
    // extra steps, and the Steam client itself answers "run" for a game it
    // owns - so when this machine's client owns the app id, the handoff is
    // the honest Play: the client starts its own game with its own services
    // already live. An app the native client does not own (a Steam living
    // in a umu prefix, say) falls through to direct exec unchanged.
    #[cfg(target_os = "linux")]
    if let Some(app_id) = steam_app_id.as_deref().filter(|id| !id.is_empty())
        && steam::native_owns_steam_app(app_id)
    {
        let mut command = steam::steam_command(&steam::steam_uri("run", app_id));
        command
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());
        command
            .spawn()
            .map_err(|e| format!("could not reach the Steam client: {e}"))?;
        LAUNCHER_PROCESSES.lock().insert(
            folder.clone(),
            Running::Steam {
                app_id: app_id.to_string(),
                game_id,
                start: SystemTime::now(),
            },
        );
        info!("handed {folder} to the Steam client as app {app_id}");
        return Ok(());
    }
    #[cfg(not(target_os = "linux"))]
    let _ = &steam_app_id;

    // Detection always carries a guess; a hand-picked folder may not, so
    // fall back to the same heuristic rather than a second answer.
    let relative = match executable.as_deref() {
        Some(rel) => rel.to_string(),
        None => importer::find_game_executable(&folder_path)
            .ok_or("could not find an executable in this folder")?,
    };
    let exe = resolve_executable(&folder_path, &relative)?;

    let log_dir = DATA_ROOT_DIR.join("logs").join("launcher");
    create_dir_all(&log_dir).map_err(|e| e.to_string())?;
    let stamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let open_log = |suffix: &str| {
        OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(log_dir.join(format!("{}-{stamp}{suffix}.log", slug_for(&folder_path))))
            .map_err(|e| e.to_string())
    };
    let log_file = open_log("")?;
    let error_file = open_log("-error")?;

    let mut command = build_command(&exe, &folder_path, prefix.as_deref(), game_id.as_deref())?;
    command
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(error_file))
        .env_remove("RUST_LOG");

    // A process group of its own: umu-run leaves wine and its services as
    // children, and Stop has to reach the whole tree, not just the parent.
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }

    let child = Arc::new(
        SharedChild::new(
            command
                .spawn()
                .map_err(|e| format!("could not start {exe:?}: {e}"))?,
        )
        .map_err(|e| format!("could not watch the game process: {e}"))?,
    );
    let start = SystemTime::now();
    LAUNCHER_PROCESSES
        .lock()
        .insert(folder.clone(), Running::Child(child.clone()));
    info!(
        "playing launcher-owned install {folder} via {}",
        exe.display()
    );

    std::thread::spawn(move || {
        let result = child.wait();
        let seconds = start.elapsed().unwrap_or(Duration::ZERO).as_secs();
        LAUNCHER_PROCESSES.lock().remove(&folder);
        info!("launcher-owned play of {folder} ended: {result:?}");
        finish_play(&app, &folder, game_id, seconds);
    });
    Ok(())
}

/// Stop a launcher-owned install that is playing. A child this command
/// spawned is killed as a whole process group (Linux) or tree (Windows) so
/// no wine server or helper survives the game - the wait thread reports it
/// through the same finish event. A Steam session is stopped the way any
/// Steam game is stopped: the client's own `steam://stop`, which reaches the
/// game and its overlay services because the client is the one running them.
#[tauri::command]
pub fn stop_launcher_install(app: AppHandle, folder: String) -> bool {
    // Take the session's shape out from behind the lock first: a child
    // stays registered while its process dies (the wait thread reports the
    // kill as its exit and removes the row), a Steam session ends right
    // here, because nothing else is watching it.
    enum Held {
        Child(Arc<SharedChild>),
        #[cfg(target_os = "linux")]
        Steam {
            app_id: String,
            game_id: Option<String>,
            seconds: u64,
        },
    }
    let Some(held) = LAUNCHER_PROCESSES
        .lock()
        .get(&folder)
        .map(|running| match running {
            Running::Child(child) => Held::Child(child.clone()),
            #[cfg(target_os = "linux")]
            Running::Steam {
                app_id,
                game_id,
                start,
            } => Held::Steam {
                app_id: app_id.clone(),
                game_id: game_id.clone(),
                seconds: start.elapsed().unwrap_or(Duration::ZERO).as_secs(),
            },
        })
    else {
        return false;
    };
    match held {
        Held::Child(child) => {
            #[cfg(unix)]
            {
                // The child is its own group leader, so a negative pid is its group.
                let _ = Command::new("kill")
                    .args(["-KILL", &format!("-{}", child.id())])
                    .status();
            }
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                let pid = child.id().to_string();
                let _ = Command::new("taskkill")
                    .args(["/F", "/T", "/PID", &pid])
                    .creation_flags(CREATE_NO_WINDOW)
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .status();
            }
            let _ = child.kill();
            true
        }
        #[cfg(target_os = "linux")]
        Held::Steam {
            app_id,
            game_id,
            seconds,
        } => {
            LAUNCHER_PROCESSES.lock().remove(&folder);
            let mut command = steam::steam_command(&steam::steam_uri("stop", &app_id));
            command
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null());
            if let Err(e) = command.spawn() {
                warn!("could not ask the Steam client to stop app {app_id}: {e}");
            }
            info!("stopped the Steam session for {folder} (app {app_id})");
            finish_play(&app, &folder, game_id, seconds);
            true
        }
    }
}
