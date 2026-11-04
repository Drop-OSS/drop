import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/**
 * Mirror of `importer::engine::ImportProgress`, flattened into the
 * `import_state` payload together with the job's identity (the Rust event
 * struct uses `#[serde(flatten)]`). Phases arrive in order; `done` marks the
 * last event of a job whatever the outcome.
 */
export type ImportPhase =
  | "hashing"
  | "uploading"
  | "committing"
  | "done"
  | "failed"
  | "cancelled";

export interface ImportProgress {
  phase: ImportPhase;
  filesDone: number;
  totalFiles: number;
  bytesHashed: number;
  totalBytes: number;
  bytesUploaded: number;
  uploadTotal: number;
  objectsDone: number;
  totalObjects: number;
  releaseDigest?: string;
  done: boolean;
  error?: string;
}

export interface ImportJob {
  jobId: string;
  gameTitle: string;
  /** Known only to the view that started it; the engine never repeats it. */
  folder: string;
  progress: ImportProgress;
}

export interface ImportStart {
  folder: string;
  gameTitle: string;
  appVersion?: string;
  /** An existing catalog game to publish a new version under. */
  gameId?: string;
}

interface ImportsState {
  jobs: Ref<ImportJob[]>;
  start: (input: ImportStart) => Promise<string>;
  cancel: (jobId: string) => Promise<boolean>;
}

const importRegistry: { jobs: Ref<ImportJob[]> } = {
  jobs: ref<ImportJob[]>([]),
};

/** The Rust payload carries the job's identity and the progress struct
 * flattened into one object (`#[serde(flatten)]`); the folder is a view-side
 * label only, never echoed back by the engine. */
type ImportEvent = {
  jobId: string;
  gameTitle: string;
  folder?: string;
} & ImportProgress;

let listening = false;

/** The one `import_state` listener; started by the first view that asks. */
const listenToImports = () => {
  if (listening) return;
  listening = true;
  void listen<ImportEvent>("import_state", (event) => {
    const { jobId, gameTitle, folder, ...progress } = event.payload;
    const known = importRegistry.jobs.value.find((j) => j.jobId === jobId);
    if (known) {
      known.progress = progress;
      return;
    }
    // A job started by another window, or before this view mounted.
    importRegistry.jobs.value.unshift({
      jobId,
      gameTitle,
      folder: folder ?? "",
      progress,
    });
  });
};

/**
 * Import jobs for this session, newest first. Memoized module state like
 * `useSaves`: the engine pushes every phase transition, so a view that opens
 * mid-import still lands on the live numbers.
 */
export const useImports = (): ImportsState => {
  const jobs = importRegistry.jobs;

  return {
    jobs,
    start: async (input) => {
      listenToImports();
      const jobId = await invoke<string>("start_game_import", {
        folder: input.folder,
        gameTitle: input.gameTitle,
        appVersion: input.appVersion || null,
        gameId: input.gameId || null,
      });
      jobs.value.unshift({
        jobId,
        gameTitle: input.gameTitle,
        folder: input.folder,
        progress: {
          phase: "hashing",
          filesDone: 0,
          totalFiles: 0,
          bytesHashed: 0,
          totalBytes: 0,
          bytesUploaded: 0,
          uploadTotal: 0,
          objectsDone: 0,
          totalObjects: 0,
          done: false,
        },
      });
      return jobId;
    },
    cancel: async (jobId) => invoke<boolean>("cancel_game_import", { jobId }),
  };
};

/**
 * How far along a job is, 0..1, on the measure that phase actually moves:
 * bytes hashed for the scan, bytes shipped for the upload. Committing is a
 * single server round trip, so it reads as finished rather than stalled.
 */
export const importFraction = (progress: ImportProgress): number => {
  if (progress.phase === "hashing") {
    return progress.totalBytes ? progress.bytesHashed / progress.totalBytes : 0;
  }
  if (progress.phase === "uploading") {
    return progress.uploadTotal
      ? progress.bytesUploaded / progress.uploadTotal
      : 1;
  }
  return 1;
};

/** The one-line label a job shows beside its bar. */
export const importPhaseLabel = (progress: ImportProgress): string => {
  switch (progress.phase) {
    case "hashing":
      return "Hashing files";
    case "uploading":
      return progress.uploadTotal ? "Uploading new files" : "Nothing to upload";
    case "committing":
      return "Publishing release";
    case "done":
      return "Published";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
  }
};
