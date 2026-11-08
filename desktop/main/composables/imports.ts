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
  /** Whether the build starts without its store client (default true). False
   * for a legit EA/Rockstar/Ubisoft folder the launch path must hand off. */
  runsStandalone?: boolean;
}

/** How a finished job ended, in the facts a batch runner and a summary line
 * both need. */
export interface ImportResult {
  ok: boolean;
  digest?: string;
  error?: string;
}

/** One install a storefront says it put on this machine. */
export interface DetectedInstall {
  launcher: string;
  title: string;
  folder: string;
  installKey?: string;
  /** The launcher's own copy, as a path inside `folder`, guessed by the
   * recipe - good enough to play; the form is where a player corrects it. */
  executable?: string;
  /** The prefix root this install lives in, when it lives in one. Playing
   * and importing treat it as the launcher's Windows filesystem. */
  prefix?: string;
}

interface ImportsState {
  jobs: Ref<ImportJob[]>;
  start: (input: ImportStart) => Promise<string>;
  cancel: (jobId: string) => Promise<boolean>;
  /** A whole set, imported one folder at a time. */
  importMany: (
    inputs: ImportStart[],
    onRunning?: (input: ImportStart) => void,
  ) => Promise<Array<{ input: ImportStart; result: ImportResult }>>;
  /** True while a batch is running, so two never overlap. */
  batching: Ref<boolean>;
}

const importRegistry = {
  jobs: ref<ImportJob[]>([]),
  batching: ref(false),
};

/** The Rust payload carries the job's identity and the progress struct
 * flattened into one object (`#[serde(flatten)]`); the folder is a view-side
 * label only, never echoed back by the engine. */
type ImportEvent = {
  jobId: string;
  gameTitle: string;
  folder?: string;
} & ImportProgress;

const waiters = new Map<string, (result: ImportResult) => void>();

const resultOf = (progress: ImportProgress): ImportResult => ({
  ok: progress.phase === "done",
  digest: progress.releaseDigest,
  error: progress.error,
});

const settle = (jobId: string, result: ImportResult) => {
  const resolve = waiters.get(jobId);
  if (!resolve) return;
  waiters.delete(jobId);
  resolve(result);
};

let listening = false;

/** The one `import_state` listener; started by the first view that asks. */
const listenToImports = () => {
  if (listening) return;
  listening = true;
  void listen<ImportEvent>("import_state", (event) => {
    const { jobId, gameTitle, folder, ...progress } = event.payload;
    const known = importRegistry.jobs.value.find((j) => j.jobId === jobId);
    if (!known) {
      // A job started by another window, or before this view mounted.
      importRegistry.jobs.value.unshift({
        jobId,
        gameTitle,
        folder: folder ?? "",
        progress,
      });
    } else {
      known.progress = progress;
    }
    if (progress.done) settle(jobId, resultOf(progress));
  });
};

/** Begin one import. Progress arrives on `import_state`, not as a return. */
const startImport = async (input: ImportStart): Promise<string> => {
  listenToImports();
  const jobId = await invoke<string>("start_game_import", {
    folder: input.folder,
    gameTitle: input.gameTitle,
    appVersion: input.appVersion || null,
    gameId: input.gameId || null,
    runsStandalone: input.runsStandalone ?? true,
  });
  importRegistry.jobs.value.unshift({
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
};

/**
 * A promise for a job's terminal event. A job that finished before anyone
 * asked resolves immediately, so a batch loop cannot miss its cue.
 */
export const waitForImport = (jobId: string): Promise<ImportResult> => {
  const known = importRegistry.jobs.value.find((j) => j.jobId === jobId);
  if (known?.progress.done) return Promise.resolve(resultOf(known.progress));
  return new Promise((resolve) => waiters.set(jobId, resolve));
};

/**
 * Import a whole set, one folder at a time, reporting each outcome.
 *
 * Sequential on purpose: two hundred-gigabyte scans compete for the same
 * disks, and a player coming from "import my EA library" cares that every
 * title arrives, not that they all started at once. A failure is one row in
 * the report, never a reason to abandon the rest of the library.
 */
const importMany = async (
  inputs: ImportStart[],
  onRunning?: (input: ImportStart) => void,
): Promise<Array<{ input: ImportStart; result: ImportResult }>> => {
  if (importRegistry.batching.value) return [];
  importRegistry.batching.value = true;
  const outcomes: Array<{ input: ImportStart; result: ImportResult }> = [];
  try {
    for (const input of inputs) {
      onRunning?.(input);
      let jobId: string;
      try {
        jobId = await startImport(input);
      } catch (e) {
        // No job at all: the command itself refused. The rest of the library
        // still gets its turn.
        outcomes.push({ input, result: { ok: false, error: String(e) } });
        continue;
      }
      outcomes.push({ input, result: await waitForImport(jobId) });
    }
  } finally {
    importRegistry.batching.value = false;
  }
  return outcomes;
};

/**
 * Import jobs for this session, newest first. Memoized module state like
 * `useSaves`: the engine pushes every phase transition, so a view that opens
 * mid-import still lands on the live numbers.
 */
export const useImports = (): ImportsState => ({
  jobs: importRegistry.jobs,
  batching: importRegistry.batching,
  start: startImport,
  cancel: async (jobId) => invoke<boolean>("cancel_game_import", { jobId }),
  importMany,
});

/** What the launchers on this machine report having installed. Reads the
 * files they left behind, so it works offline. */
export const detectLauncherInstalls = (extraPrefixes?: string[]) =>
  invoke<DetectedInstall[]>("detect_launcher_installs", {
    extraPrefixes: extraPrefixes ?? null,
  });

/** An install playing from its own folder. */
export interface LauncherPlayInput {
  folder: string;
  /** Path inside `folder`; omitted lets the same heuristic pick one. */
  executable?: string;
  /** The prefix the install was found in, so the game runs in its own. */
  prefix?: string;
  /** The catalog game it matches; playtime of a session goes there. */
  gameId?: string;
  /** A Steam app id: with it, and a native client that owns the game, Play
   * hands off to the client (`steam://run`) instead of exec'ing the exe. */
  steamAppId?: string;
}

/** Folders with a launcher-owned copy playing right now. */
const playingRegistry = ref<string[]>([]);

let playListening = false;
const listenToPlay = () => {
  if (playListening) return;
  playListening = true;
  void listen<{ folder: string }>("launcher_play_finished", (event) => {
    // The wait thread fires this for natural exits and stops alike, so the
    // only bookkeeping is removing the row that ended.
    playingRegistry.value = playingRegistry.value.filter(
      (folder) => folder !== event.payload.folder,
    );
  });
};

/**
 * Play the storefront's own copy in place - no depot copy, no install. The
 * running set is module state like the import jobs: a view opened mid-game
 * sees the row as playing, and every finish takes its own row out.
 */
export const useLauncherPlay = () => ({
  playing: playingRegistry,
  play: async (input: LauncherPlayInput) => {
    listenToPlay();
    if (playingRegistry.value.includes(input.folder)) return;
    playingRegistry.value = [...playingRegistry.value, input.folder];
    try {
      await invoke<void>("play_launcher_install", {
        folder: input.folder,
        executable: input.executable || null,
        prefix: input.prefix || null,
        gameId: input.gameId || null,
        steamAppId: input.steamAppId || null,
      });
    } catch (e) {
      // Refused before anything started; the row was never really playing.
      playingRegistry.value = playingRegistry.value.filter(
        (folder) => folder !== input.folder,
      );
      throw e;
    }
  },
  /** Stop reaches the whole process tree; the finish event updates the row. */
  stop: (folder: string) =>
    invoke<boolean>("stop_launcher_install", { folder }),
});

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
