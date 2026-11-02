import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/**
 * Mirror of the Rust types in `desktop/src-tauri/cloud_saves`:
 * `client::SaveVersion` (the server's version DTO) and
 * `engine::SaveSyncOutcome` (internally tagged by `kind`, camelCase).
 */
export interface SaveVersion {
  id: string;
  contentHash?: string;
  archiveSha256?: string;
  sizeBytes?: number;
  fileCount?: number;
  kind: "Backup" | "Restore" | "ConflictKeepLocal" | "Import" | "Legacy" | "Safety";
  pinned: boolean;
  restoredFromVersionId?: string;
  createdAt: string;
}

export type SaveSyncOutcome =
  | { kind: "notManaged" }
  | { kind: "clean"; decision: string }
  | { kind: "pulled"; versionId: string; written: number; skipped: string[] }
  | { kind: "pushed"; versionId: string; contentHash: string; fileCount: number }
  | {
      kind: "conflict";
      headVersionId?: string;
      headContentHash?: string;
      localContentHash: string;
      at: string;
    }
  | { kind: "failed"; stage: string; error: string };

export type ConflictChoice = "keepLocal" | "keepServer" | "keepBoth";

interface SavesState {
  versions: Ref<SaveVersion[]>;
  outcome: Ref<SaveSyncOutcome | undefined>;
  loading: Ref<boolean>;
  load: () => Promise<void>;
}

const savesRegistry: { [gameId: string]: SavesState } = {};

/**
 * Per-game cloud-saves state, memoized like `useGame`: the first call for a
 * game registers the `saves_state` listener, later calls share the refs.
 * Timeline fetches are explicit (`load()`); sync/restore/pin commands emit
 * the event, which refreshes the list automatically.
 */
export const useSaves = (gameId: string): SavesState => {
  if (!savesRegistry[gameId]) {
    const state: SavesState = {
      versions: ref<SaveVersion[]>([]),
      outcome: ref<SaveSyncOutcome | undefined>(undefined),
      loading: ref(false),
      load: async () => {},
    };
    state.load = async () => {
      state.loading.value = true;
      try {
        state.versions.value = await invoke<SaveVersion[]>("fetch_save_timeline", {
          gameId,
        });
      } catch (e) {
        // No server connection or unmanaged game: keep what we had.
        console.warn("save timeline fetch failed:", e);
      } finally {
        state.loading.value = false;
      }
    };
    savesRegistry[gameId] = state;

    listen("saves_state", (event) => {
      const payload = event.payload as {
        gameId: string;
        slot: number;
        outcome: SaveSyncOutcome;
      };
      if (payload.gameId !== gameId) return;
      state.outcome.value = payload.outcome;
      // Push/pull/restore all changed the server timeline; a conflict is
      // resolved through the dialog, which reloads on its own answer.
      if (payload.outcome.kind !== "conflict") {
        void state.load();
      }
    });
  }
  return savesRegistry[gameId];
};

export const syncGameSaves = (gameId: string) =>
  invoke<SaveSyncOutcome | null>("sync_game_saves", { gameId });

export const restoreSaveVersion = (gameId: string, versionId: string) =>
  invoke<SaveSyncOutcome | null>("restore_save_version", { gameId, versionId });

export const setSaveVersionPinned = (
  gameId: string,
  versionId: string,
  pinned: boolean,
) => invoke<SaveVersion>("set_save_version_pinned", { gameId, versionId, pinned });

export const resolveSaveConflict = (gameId: string, choice: ConflictChoice) =>
  invoke<SaveSyncOutcome | null>("resolve_save_conflict", { gameId, choice });
