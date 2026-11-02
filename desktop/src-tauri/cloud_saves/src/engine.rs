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
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use database::{GameDownloadStatus, SaveJournal, borrow_db_mut_checked, platform::Platform};
use serde::{Deserialize, Serialize};

use crate::archive::{build_archive, extract_archive};
use crate::canonical::content_hash;
use crate::client::{MutationOutcome, SaveClient, SaveVersion, SyncDecision, SyncState};
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
    /// The profile the sync acts as, snapshotted with the plan so every
    /// journal row of one flow is keyed consistently even if the user
    /// switches profiles mid-sync. `None` = the account's default profile.
    pub profile_id: Option<String>,
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
    let profile_id = db.current_profile_id.clone();
    let journal = db
        .applications
        .cloud_saves
        .get(&journal_key(profile_id.as_deref(), game_id, slot))
        .cloned()
        .unwrap_or_default();
    let client = SaveClient::from_desktop().ok()?;
    Some(SyncPlan {
        client,
        game_id: game_id.to_string(),
        slot,
        profile_id,
        context,
        journal,
    })
}

/// Journals are keyed by player as well as game and slot: what one profile
/// last synced says nothing about another's. `None` keeps the pre-profile
/// key, so an account that never touches the switcher is undisturbed; first
/// use of a named profile starts a fresh journal (a harmless one-off
/// re-sync, since the server timeline is the source of truth).
fn journal_key(profile: Option<&str>, game_id: &str, slot: u32) -> String {
    match profile {
        Some(profile) => format!("{profile}/{game_id}/{slot}"),
        None => format!("{game_id}/{slot}"),
    }
}

fn store_journal(plan: &SyncPlan, journal: &SaveJournal) {
    let mut db = borrow_db_mut_checked();
    let key = journal_key(plan.profile_id.as_deref(), &plan.game_id, plan.slot);
    db.applications
        .cloud_saves
        .insert(key, journal.clone());
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
            push(
                plan,
                &manifest,
                &context,
                &resolved.files,
                &local_hash,
                plan.journal.base_version_id.as_deref(),
            )
            .await?
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
            store_journal(plan, &journal);
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
    store_journal(plan, &journal);

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
    base_version_id: Option<&str>,
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
    store_journal(plan, &journal);

    let outcome = plan
        .client
        .upload(
            &plan.game_id,
            plan.slot,
            built.bytes,
            base_version_id,
            &attempt_key,
            &built.content_hash,
            &built.archive_sha256,
            built.file_count,
            &manifest.entry_hash,
        )
        .await;

    match outcome {
        Ok(MutationOutcome::Stored(version)) => {
            let mut journal = plan.journal.clone();
            journal.base_version_id = Some(version.id.clone());
            journal.last_content_hash = Some(local_hash.to_string());
            journal.entry_hash = Some(manifest.entry_hash.clone());
            journal.pending_idempotency = None;
            journal.last_synced_at = Some(now_secs());
            store_journal(plan, &journal);
            Ok(SaveSyncOutcome::Pushed {
                version_id: version.id,
                content_hash: built.content_hash,
                file_count: built.file_count,
            })
        }
        Ok(MutationOutcome::Conflict { head_version_id }) => {
            // A firm answer: this attempt is over; a future sync starts a new
            // attempt (with a new key) after the user decides.
            let mut journal = plan.journal.clone();
            journal.pending_idempotency = None;
            journal.last_content_hash = Some(local_hash.to_string());
            store_journal(plan, &journal);
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

/// The user's answer to a conflict - the engine never guesses one.
/// Serialized as `"keepLocal" | "keepServer" | "keepBoth"` for the UI.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ConflictChoice {
    /// Upload this device's save on top of the server head (the server
    /// version stays in history and is restorable from the timeline).
    KeepLocal,
    /// Write the server head to disk, replacing this device's save. The
    /// conflict dialog must have made the user say that out loud.
    KeepServer,
    /// Pin the server head (retention can never prune it) and push the
    /// local save on top: both worlds live on in the timeline, the disk
    /// keeps the local one, and the user can pick either later.
    KeepBoth,
}

/// Manifest, resolution environment and on-disk state, freshly read.
/// Resolution re-derives the game dir from the manifest's `installDir`.
struct LocalSave {
    manifest: SaveManifest,
    context: ResolutionContext,
    resolved: crate::context::ResolvedSave,
    local_hash: String,
}

async fn read_local(plan: &SyncPlan) -> Result<Option<LocalSave>, SaveError> {
    let Some(manifest) = plan.client.manifest(&plan.game_id).await? else {
        return Ok(None);
    };
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
    Ok(Some(LocalSave {
        manifest,
        context,
        resolved,
        local_hash,
    }))
}

/// Publish `version_id`'s content as the new head and write it to disk.
/// History is never rewritten (the server creates a fresh `Restore`
/// version); the `If-Match` baseline is the *current* head, because the
/// user's intent is "this becomes the save" - if the head moves between
/// reading it and restoring, the 409 is honest and surfaces as a conflict.
pub async fn restore_to_version(
    plan: &SyncPlan,
    version_id: &str,
) -> Result<SaveSyncOutcome, SaveError> {
    let Some(local) = read_local(plan).await? else {
        return Ok(SaveSyncOutcome::NotManaged);
    };
    let head = current_head(plan).await?;
    match plan
        .client
        .restore(
            &plan.game_id,
            plan.slot,
            version_id,
            head.as_ref().map(|h| h.id.as_str()),
        )
        .await?
    {
        MutationOutcome::Stored(version) => {
            apply_pull(plan, &local.manifest, &local.resolved.sites, &version).await
        }
        MutationOutcome::Conflict { head_version_id } => Ok(SaveSyncOutcome::Conflict {
            head_version_id,
            head_content_hash: head.and_then(|h| h.content_hash),
            local_content_hash: local.local_hash,
            at: "restore".to_string(),
        }),
    }
}

/// The always-ask answer, applied. Whatever the user chose, this ends with
/// disk and journal agreeing with exactly one version - and no data ever
/// leaving history, since versions are immutable and `KeepBoth` pins.
pub async fn resolve_conflict(
    plan: &SyncPlan,
    choice: ConflictChoice,
) -> Result<SaveSyncOutcome, SaveError> {
    let Some(local) = read_local(plan).await? else {
        return Ok(SaveSyncOutcome::NotManaged);
    };
    let Some(head) = current_head(plan).await? else {
        // Nothing on the server (anymore): every choice converges on
        // "back the local save up", which is the normal push flow.
        return push(
            plan,
            &local.manifest,
            &local.context,
            &local.resolved.files,
            &local.local_hash,
            plan.journal.base_version_id.as_deref(),
        )
        .await;
    };
    match choice {
        ConflictChoice::KeepServer => {
            apply_pull(plan, &local.manifest, &local.resolved.sites, &head).await
        }
        ConflictChoice::KeepLocal => {
            push(
                plan,
                &local.manifest,
                &local.context,
                &local.resolved.files,
                &local.local_hash,
                Some(&head.id),
            )
            .await
        }
        ConflictChoice::KeepBoth => {
            plan.client
                .set_pinned(&plan.game_id, plan.slot, &head.id, true)
                .await?;
            push(
                plan,
                &local.manifest,
                &local.context,
                &local.resolved.files,
                &local.local_hash,
                Some(&head.id),
            )
            .await
        }
    }
}

async fn current_head(plan: &SyncPlan) -> Result<Option<SaveVersion>, SaveError> {
    Ok(plan
        .client
        .slot(&plan.game_id, plan.slot)
        .await?
        .and_then(|slot| slot.head))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn journal_key_includes_slot() {
        assert_eq!(journal_key(None, "g1", 0), "g1/0");
        assert_ne!(journal_key(None, "g1", 0), journal_key(None, "g1", 1));
        // A named player's journal is disjoint from the default's and from
        // any other player's.
        assert_eq!(journal_key(Some("p1"), "g1", 0), "p1/g1/0");
        assert_ne!(journal_key(Some("p1"), "g1", 0), journal_key(None, "g1", 0));
        assert_ne!(journal_key(Some("p1"), "g1", 0), journal_key(Some("p2"), "g1", 0));
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
