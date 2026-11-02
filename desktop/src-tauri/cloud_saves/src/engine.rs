//! The two device-side flows the roadmap promises:
//!
//! - **before launch**: ask the server what to do; only *pull* - never push,
//!   never merge - and only when the local save is clean;
//! - **after exit**: back the save up, with `If-Match` so a device that was
//!   offline while another moved the head gets a conflict instead of silently
//!   overwriting it.
//!
//! Conflicts are never resolved here. Every entry point returns a
//! [`SaveSyncOutcome`] for the UI (roadmap step 4) to render; v1's correct
//! answer to a conflict is to keep both worlds intact and say so.

use std::{
    collections::BTreeMap,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use database::{GameDownloadStatus, SaveJournal, borrow_db_mut_checked, platform::Platform};
use serde::Serialize;

use crate::archive::{build_archive, extract_archive};
use crate::canonical::content_hash;
use crate::client::{SaveClient, SyncDecision, SyncState, UploadOutcome};
use crate::context::{ResolutionContext, resolve_manifest, write_targets};
use crate::error::SaveError;
use crate::manifest::SaveManifest;

/// v1 devices only ever use the auto slot.
pub const AUTO_SLOT: u32 = 0;

/// What a sync attempt concluded, shaped for Tauri events and (step 4) the
/// game-page timeline.
#[derive(Clone, Debug, Serialize)]
#[serde(
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    tag = "kind"
)]
pub enum SaveSyncOutcome {
    /// No curated manifest or the game is not installed: saves for this game
    /// are not managed.
    NotManaged,
    Clean {
        decision: String,
    },
    Pulled {
        version_id: String,
        written: usize,
        skipped: Vec<String>,
    },
    Pushed {
        version_id: String,
        content_hash: String,
        file_count: usize,
    },
    Conflict {
        /// Set when the conflict came from a stale `If-Match` (the server
        /// named the head); sync-endpoint conflicts compute it from the slot.
        head_version_id: Option<String>,
        head_content_hash: Option<String>,
        local_content_hash: String,
        at: String,
    },
    Failed {
        stage: String,
        error: String,
    },
}

/// Payload of the `saves_state` Tauri event, emitted after every sync flow
/// (launch, exit, manual) so the UI can render state without polling.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveStateEvent {
    pub game_id: String,
    pub slot: u32,
    pub outcome: SaveSyncOutcome,
}

/// Everything a sync needs, snapshotted from the database before any await
/// (the database lock must never be held across a network call).
pub struct SyncPlan {
    pub client: SaveClient,
    pub game_id: String,
    pub slot: u32,
    pub context: ResolutionContext,
    pub journal: SaveJournal,
}

/// Snapshot the installed game + journal into a plan, or `None` when the game
/// is not locally installed (cloud saves act on installed games only).
pub fn build_plan(game_id: &str, slot: u32) -> Option<SyncPlan> {
    let db = database::borrow_db_checked();
    let meta = db.applications.installed_game_version.get(game_id)?;
    let GameDownloadStatus::Installed { install_dir, .. } =
        db.applications.game_statuses.get(game_id)?
    else {
        return None;
    };
    let host = Platform::HOST;
    let target = meta.target_platform;
    let mut context = ResolutionContext::new(host, target, PathBuf::from(install_dir));
    if host == Platform::Linux && target == Platform::Windows {
        // UMU/Proton game: the process handlers create the prefix at
        // `<data root>/pfx/<game_id>`; saves live inside it.
        context = context.with_prefix(database::db::DATA_ROOT_DIR.join("pfx").join(game_id));
    }
    let journal = db
        .applications
        .cloud_saves
        .get(&journal_key(game_id, slot))
        .cloned()
        .unwrap_or_default();
    let client = SaveClient::from_desktop().ok()?;
    Some(SyncPlan {
        client,
        game_id: game_id.to_string(),
        slot,
        context,
        journal,
    })
}

fn journal_key(game_id: &str, slot: u32) -> String {
    format!("{game_id}/{slot}")
}

fn store_journal(game_id: &str, slot: u32, journal: &SaveJournal) {
    let mut db = borrow_db_mut_checked();
    db.applications
        .cloud_saves
        .insert(journal_key(game_id, slot), journal.clone());
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Pre-launch sync. `Some(outcome)` when the game is save-managed.
pub async fn pre_launch(game_id: &str) -> Option<SaveSyncOutcome> {
    let plan = build_plan(game_id, AUTO_SLOT)?;
    Some(sync_at(&plan, "launch").await)
}

/// Post-exit backup. `Some(outcome)` when the game is save-managed.
pub async fn post_exit(game_id: &str) -> Option<SaveSyncOutcome> {
    let plan = build_plan(game_id, AUTO_SLOT)?;
    Some(sync_at(&plan, "exit").await)
}

/// Drive one device-side sync round for a plan against the real server.
pub async fn sync_at(plan: &SyncPlan, at: &str) -> SaveSyncOutcome {
    match step(plan, at).await {
        Ok(Some(outcome)) => outcome,
        Ok(None) => SaveSyncOutcome::NotManaged,
        Err(error) => {
            log::warn!("cloud saves ({at}) failed for {}: {error}", plan.game_id);
            SaveSyncOutcome::Failed {
                stage: at.to_string(),
                error: error.to_string(),
            }
        }
    }
}

async fn step(plan: &SyncPlan, at: &str) -> Result<Option<SaveSyncOutcome>, SaveError> {
    let Some(manifest) = plan.client.manifest(&plan.game_id).await? else {
        return Ok(None);
    };
    // The manifest's installDir tail (if any) re-targets `<game>`/`<base>`.
    let mut context = plan.context.clone();
    context.game_dir = manifest.install_dirs.first().cloned();

    let resolved = resolve_manifest(&context, &manifest)?;
    let local_hash = content_hash(
        &resolved
            .files
            .iter()
            .map(|f| f.content_file())
            .collect::<Vec<_>>(),
    );

    let sync = plan
        .client
        .sync(
            &plan.game_id,
            plan.slot,
            plan.journal.base_version_id.as_deref(),
            Some(&local_hash),
        )
        .await?;

    let outcome = match (sync.decision, sync.head.as_ref()) {
        (SyncDecision::Pull, Some(head)) => {
            apply_pull(plan, &manifest, &resolved.sites, head).await?
        }
        // Local is ahead of the agreed baseline (or there is no baseline and
        // we have saves): back it up. At launch this recovers a session whose
        // exit backup never completed.
        (SyncDecision::Push, _) => {
            push(plan, &manifest, &context, &resolved.files, &local_hash).await?
        }
        // A head that moved while our copy stayed put is safe to pull at
        // either point: nothing local can be lost.
        (SyncDecision::Converged | SyncDecision::Noop, head) => {
            let mut journal = plan.journal.clone();
            journal.last_content_hash = Some(local_hash.clone());
            journal.entry_hash = Some(manifest.entry_hash.clone());
            journal.pending_idempotency = None;
            if let Some(head) = head {
                journal.base_version_id = Some(head.id.clone());
            }
            journal.last_synced_at = Some(now_secs());
            store_journal(&plan.game_id, plan.slot, &journal);
            SaveSyncOutcome::Clean {
                decision: sync.decision.to_string(),
            }
        }
        (SyncDecision::Conflict, head) => SaveSyncOutcome::Conflict {
            head_version_id: head.map(|h| h.id.clone()),
            head_content_hash: head.and_then(|h| h.content_hash.clone()),
            local_content_hash: local_hash.clone(),
            at: at.to_string(),
        },
        // "pull" with no head cannot happen (no head => no pull), but be
        // explicit rather than silently falling through.
        (decision, None) => SaveSyncOutcome::Clean {
            decision: decision.to_string(),
        },
    };
    Ok(Some(outcome))
}

/// Download a head version and write it to the locally resolved locations.
async fn apply_pull(
    plan: &SyncPlan,
    manifest: &SaveManifest,
    sites: &[(String, PathBuf)],
    head: &crate::client::SaveVersion,
) -> Result<SaveSyncOutcome, SaveError> {
    let (bytes, _headers) = plan
        .client
        .download(&plan.game_id, plan.slot, &head.id)
        .await?;

    // Which keys does the archive hold? Only the metadata member knows before
    // extraction; extract_archive validates them and reports what it mapped.
    let keys = archive_keys(&bytes)?;
    let (writes, mut skipped) = write_targets(sites, &keys);
    let extracted = extract_archive(&bytes, head.archive_sha256.as_deref(), &writes)?;
    skipped.extend(extracted.skipped);
    skipped.sort();

    let mut journal = plan.journal.clone();
    journal.base_version_id = Some(head.id.clone());
    journal.last_content_hash = Some(
        head.content_hash
            .clone()
            .unwrap_or_else(|| "unknown".to_string()),
    );
    journal.entry_hash = Some(manifest.entry_hash.clone());
    journal.pending_idempotency = None;
    journal.last_synced_at = Some(now_secs());
    store_journal(&plan.game_id, plan.slot, &journal);

    Ok(SaveSyncOutcome::Pulled {
        version_id: head.id.clone(),
        written: extracted.written.len(),
        skipped,
    })
}

/// List archive member keys (without validating) purely to learn where files
/// would land; full validation happens in `extract_archive`.
fn archive_keys(bytes: &[u8]) -> Result<Vec<String>, SaveError> {
    let tar_bytes = zstd::decode_all(std::io::Cursor::new(bytes.to_vec()))?;
    let mut archive = tar::Archive::new(std::io::Cursor::new(tar_bytes));
    let mut keys = Vec::new();
    for entry in archive.entries()? {
        let entry = entry?;
        let name = entry.path()?.to_string_lossy().to_string();
        if name != crate::archive::METADATA_MEMBER {
            keys.push(name);
        }
    }
    keys.sort();
    Ok(keys)
}

/// Build the backup and store it as a new version, honoring the pending
/// idempotency key across retries.
async fn push(
    plan: &SyncPlan,
    manifest: &SaveManifest,
    context: &ResolutionContext,
    files: &[crate::context::ResolvedFile],
    local_hash: &str,
) -> Result<SaveSyncOutcome, SaveError> {
    let built = build_archive(
        files,
        &manifest.entry_hash,
        &context.environment().to_string(),
    )?;
    if built.content_hash != local_hash {
        return Err(SaveError::Corrupt(format!(
            "content changed between hash and upload ({local_hash} vs {})",
            built.content_hash
        )));
    }

    let attempt_key = plan
        .journal
        .pending_idempotency
        .clone()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let mut journal = plan.journal.clone();
    journal.pending_idempotency = Some(attempt_key.clone());
    store_journal(&plan.game_id, plan.slot, &journal);

    let outcome = plan
        .client
        .upload(
            &plan.game_id,
            plan.slot,
            built.bytes,
            plan.journal.base_version_id.as_deref(),
            &attempt_key,
            &built.content_hash,
            &built.archive_sha256,
            built.file_count,
            &manifest.entry_hash,
        )
        .await;

    match outcome {
        Ok(UploadOutcome::Stored(version)) => {
            let mut journal = plan.journal.clone();
            journal.base_version_id = Some(version.id.clone());
            journal.last_content_hash = Some(local_hash.to_string());
            journal.entry_hash = Some(manifest.entry_hash.clone());
            journal.pending_idempotency = None;
            journal.last_synced_at = Some(now_secs());
            store_journal(&plan.game_id, plan.slot, &journal);
            Ok(SaveSyncOutcome::Pushed {
                version_id: version.id,
                content_hash: built.content_hash,
                file_count: built.file_count,
            })
        }
        Ok(UploadOutcome::Conflict { head_version_id }) => {
            // A firm answer: this attempt is over; a future sync starts a new
            // attempt (with a new key) after the user decides.
            let mut journal = plan.journal.clone();
            journal.pending_idempotency = None;
            journal.last_content_hash = Some(local_hash.to_string());
            store_journal(&plan.game_id, plan.slot, &journal);
            Ok(SaveSyncOutcome::Conflict {
                head_version_id,
                head_content_hash: None,
                local_content_hash: local_hash.to_string(),
                at: "upload".to_string(),
            })
        }
        Err(error) => {
            // No answer: keep the pending key so a retry replays instead of
            // double-versioning.
            Err(error)
        }
    }
}

/// The current sync view without applying anything (for UI status rows).
pub async fn inspect(plan: &SyncPlan) -> Result<SyncState, SaveError> {
    plan.client
        .sync(
            &plan.game_id,
            plan.slot,
            plan.journal.base_version_id.as_deref(),
            plan.journal.last_content_hash.as_deref(),
        )
        .await
}

/// Used by the UI (step 4) to seed a conflict dialog: everything known about
/// both sides, without choosing. (Lives here so the type the event carries is
/// defined next to the event; not constructed until the UI exists.)
#[allow(dead_code)]
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictSides {
    pub head_version_id: Option<String>,
    pub head_content_hash: Option<String>,
    pub local_content_hash: String,
    pub files: BTreeMap<String, u64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn journal_key_includes_slot() {
        assert_eq!(journal_key("g1", 0), "g1/0");
        assert_ne!(journal_key("g1", 0), journal_key("g1", 1));
    }

    #[test]
    fn outcomes_serialize_camel_case() {
        let outcome = SaveSyncOutcome::Pulled {
            version_id: "v1".into(),
            written: 3,
            skipped: vec!["a/b".into()],
        };
        let json = serde_json::to_value(&outcome).unwrap();
        assert_eq!(json["kind"], "pulled");
        assert_eq!(json["versionId"], "v1");
        assert_eq!(json["skipped"][0], "a/b");
    }
}
