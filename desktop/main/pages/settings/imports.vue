<template>
  <div class="border-b border-surface-700 py-5">
    <h3 class="text-base font-semibold font-display leading-6 text-ink-100">
      Game files
    </h3>
  </div>

  <div class="mt-5">
    <p class="max-w-xl text-sm text-ink-400">
      Import a folder your store launcher already keeps current. Drop hashes it
      into the depot's own chunk format and uploads only the files the server
      does not already hold, so the download your launcher paid for serves
      everyone after you. Importing publishes a release, which this server
      allows admins only.
    </p>

    <div v-if="!isAdmin" class="mt-6 max-w-xl rounded-md bg-surface-800 p-4">
      <p class="text-sm text-ink-300">
        You are not signed in as an admin, so imports will be rejected by the
        server. The rest of this page is left visible so you can see what
        importing looks like.
      </p>
    </div>

    <div v-if="detected.length" class="mt-6 max-w-xl">
      <div class="flex items-center justify-between gap-x-4">
        <h3 class="text-sm font-medium text-ink-100">
          Installs your launchers found
        </h3>
        <div class="flex items-center gap-x-4">
          <button
            type="button"
            class="text-sm text-ink-400 hover:text-ink-100"
            @click="scanAnotherPrefix"
          >
            Scan a prefix
          </button>
          <button
            type="button"
            class="text-sm text-ink-400 hover:text-ink-100"
            @click="loadDetected"
          >
            Rescan
          </button>
          <button
            type="button"
            :disabled="batching"
            :class="[
              batching
                ? 'cursor-not-allowed bg-surface-700 text-ink-500'
                : 'bg-accent-600 hover:bg-accent-500',
              'rounded-md px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm',
            ]"
            @click="importAllDetected"
          >
            Import all
          </button>
        </div>
      </div>
      <ul role="list" class="mt-2 divide-y divide-surface-700">
        <li
          v-for="install in detected"
          :key="install.folder"
          class="flex items-center justify-between gap-x-6 py-3"
        >
          <div class="min-w-0">
            <p class="truncate text-sm text-ink-100">{{ install.title }}</p>
            <p class="truncate text-xs text-ink-500">{{ install.folder }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-x-2">
            <button
              type="button"
              :class="
                playing.includes(install.folder)
                  ? 'bg-red-500/80 text-white hover:bg-red-500'
                  : 'bg-surface-700 text-ink-100 hover:bg-surface-600'
              "
              class="rounded-md px-2.5 py-1.5 text-xs font-semibold shadow-sm"
              @click="togglePlay(install)"
            >
              {{ playing.includes(install.folder) ? "Stop" : "Play" }}
            </button>
            <button
              v-if="matchedGame(install)"
              type="button"
              class="rounded-md bg-accent-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent-500"
              @click="resyncInstall(install)"
            >
              {{ nodeUpdated(install) ? "Upload" : "Resync" }}
            </button>
            <button
              v-else
              type="button"
              class="rounded-md bg-surface-700 px-2.5 py-1.5 text-xs font-semibold text-ink-100 hover:bg-surface-600"
              @click="chooseInstall(install)"
            >
              Choose
            </button>
          </div>
        </li>
      </ul>
      <p class="mt-1 text-sm text-ink-400">
        A game the library already knows publishes straight into it with one
        press; the rest fill the form below, where you can check the folder and
        the title first - what the launcher called a folder is not always what
        the catalog should call a game. GOG, Epic and Ubisoft games the depot
        keeps its own copy of are updated by the depot itself from the store, so
        their upload seeds it once; for EA and Rockstar games the launcher copy
        stays current and Resync is how the depot catches up. Play runs the
        launcher's own copy where it lies, in the prefix it was found in; a
        session counts toward the game it matches.
      </p>
      <p v-if="batchSummary" class="mt-2 text-sm text-ink-300">
        {{ batchSummary }}
      </p>
    </div>

    <div class="mt-6 max-w-xl space-y-4">
      <div>
        <label class="block text-sm font-medium text-ink-100"
          >Game folder</label
        >
        <div class="mt-2 flex gap-2">
          <input
            :value="folder"
            readonly
            placeholder="Choose a folder the launcher installed a game into"
            class="block w-full rounded-md border-0 px-3 py-1.5 text-ink-100 shadow-sm ring-1 ring-inset ring-surface-700 bg-surface-800 placeholder:text-ink-500 focus:ring-2 focus:ring-inset focus:ring-accent-600 sm:text-sm"
          />
          <button
            type="button"
            @click="pickFolder"
            class="shrink-0 rounded-md bg-surface-700 px-3 py-2 text-sm font-semibold text-ink-100 shadow-sm hover:bg-surface-600"
          >
            Browse
          </button>
        </div>
      </div>

      <div>
        <label
          for="import-title"
          class="block text-sm font-medium text-ink-100"
        >
          Title
        </label>
        <input
          id="import-title"
          v-model="title"
          type="text"
          placeholder="The name the catalog should carry"
          class="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-ink-100 shadow-sm ring-1 ring-inset ring-surface-700 bg-surface-800 placeholder:text-ink-500 focus:ring-2 focus:ring-inset focus:ring-accent-600 sm:text-sm"
        />
      </div>

      <div>
        <label
          for="import-version"
          class="block text-sm font-medium text-ink-100"
        >
          Version label
        </label>
        <input
          id="import-version"
          v-model="appVersion"
          type="text"
          placeholder="Optional - what the launcher calls this build"
          class="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-ink-100 shadow-sm ring-1 ring-inset ring-surface-700 bg-surface-800 placeholder:text-ink-500 focus:ring-2 focus:ring-inset focus:ring-accent-600 sm:text-sm"
        />
      </div>

      <div>
        <label class="flex items-start gap-3">
          <input
            v-model="runsStandalone"
            type="checkbox"
            class="mt-0.5 h-4 w-4 shrink-0 rounded border-surface-600 bg-surface-800 text-accent-600 focus:ring-accent-600"
          />
          <span class="text-sm text-ink-100">
            This build starts without its store client
            <span class="mt-1 block text-ink-400">
              Leave it on for DRM-free or self-starting builds. A legitimate EA,
              Rockstar or Ubisoft copy needs its launcher running to
              authenticate, so turn it off for those - playing one then hands
              off to the store client instead of exec'ing the game directly.
            </span>
          </span>
        </label>
      </div>

      <div>
        <label for="import-game" class="block text-sm font-medium text-ink-100">
          Publish as
        </label>
        <select
          id="import-game"
          v-model="gameId"
          class="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-ink-100 shadow-sm ring-1 ring-inset ring-surface-700 bg-surface-800 focus:ring-2 focus:ring-inset focus:ring-accent-600 sm:text-sm"
        >
          <option value="">a new game in the library</option>
          <option v-for="game in gameChoices" :key="game.id" :value="game.id">
            a new version of {{ game.mName }}
          </option>
        </select>
        <p class="mt-2 text-sm text-ink-400">
          Importing the same files again costs nothing: a resync after a
          launcher patch uploads only what the patch changed.
        </p>
      </div>

      <div v-if="startError" class="text-sm text-red-400">{{ startError }}</div>

      <button
        type="button"
        :disabled="!canStart"
        :class="[
          canStart
            ? 'bg-accent-600 hover:bg-accent-500'
            : 'cursor-not-allowed bg-surface-700 text-ink-500',
          'relative inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm',
        ]"
        @click="startImport"
      >
        Start import
      </button>
    </div>
  </div>

  <div v-if="jobs.length" class="mt-10 border-t border-surface-600 pt-6">
    <h3 class="text-base font-display font-semibold text-ink-100">
      Import jobs
    </h3>
    <ul role="list" class="divide-y divide-surface-700">
      <li v-for="job in jobs" :key="job.jobId" class="py-5">
        <div class="flex items-center justify-between gap-x-6">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-ink-100">
              {{ job.gameTitle }}
            </p>
            <p v-if="job.folder" class="truncate text-xs text-ink-500">
              {{ job.folder }}
            </p>
          </div>
          <button
            v-if="!job.progress.done"
            type="button"
            class="shrink-0 text-sm text-ink-400 hover:text-ink-100"
            @click="cancel(job.jobId)"
          >
            Cancel
          </button>
          <span
            v-else-if="job.progress.phase === 'done'"
            class="shrink-0 text-sm text-emerald-400"
          >
            Published
          </span>
        </div>

        <div
          v-if="job.progress.phase !== 'done'"
          class="mt-2 h-2 w-full max-w-xl overflow-hidden rounded-lg bg-surface-800"
        >
          <div
            :class="
              job.progress.phase === 'failed' ? 'bg-red-500' : 'bg-accent-600'
            "
            class="h-2"
            :style="{ width: `${importFraction(job.progress) * 100}%` }"
          />
        </div>

        <div class="mt-2 flex flex-wrap gap-x-4 text-sm text-ink-400">
          <span class="text-ink-300">{{ importPhaseLabel(job.progress) }}</span>
          <span v-if="job.progress.totalFiles">
            {{ job.progress.filesDone }}/{{ job.progress.totalFiles }} files
          </span>
          <span
            v-if="job.progress.phase === 'hashing' && job.progress.totalBytes"
          >
            {{ humanBytes(job.progress.bytesHashed) }} of
            {{ humanBytes(job.progress.totalBytes) }} hashed
          </span>
          <span v-if="job.progress.uploadTotal">
            {{ humanBytes(job.progress.bytesUploaded) }} of
            {{ humanBytes(job.progress.uploadTotal) }} to upload
          </span>
          <span v-if="job.progress.releaseDigest" class="font-mono text-xs">
            {{ job.progress.releaseDigest.slice(0, 16) }}
          </span>
        </div>

        <p v-if="job.progress.error" class="mt-2 text-sm text-red-400">
          {{ job.progress.error }}
        </p>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { Game } from "~/types";
import {
  detectLauncherInstalls,
  importFraction,
  importPhaseLabel,
  useImports,
  useLauncherPlay,
  type DetectedInstall,
} from "~/composables/imports";

const appState = useAppState();
const isAdmin = computed(() => appState.value?.user?.admin ?? false);

const { jobs, start, cancel, importMany, batching } = useImports();
const { playing, play, stop: stopPlay } = useLauncherPlay();

const folder = ref("");
const title = ref("");
const appVersion = ref("");
const gameId = ref("");
/** Whether the manual import's build starts on its own; a legit store build
 * the client must launch flips this off. See `standaloneByLauncher`. */
const runsStandalone = ref(true);
const startError = ref<string | null>(null);

/** Catalog titles a resync can publish a new version under. */
const library = await invoke<{ library: Game[]; other: Game[] }>(
  "fetch_library",
  {
    hardRefresh: false,
  },
).catch(() => undefined);
const gameChoices = computed(() =>
  [...(library?.library ?? []), ...(library?.other ?? [])]
    .map((game) => ({ id: game.id, mName: game.mName }))
    .sort((a, b) => a.mName.localeCompare(b.mName)),
);

/**
 * A title folded to the shape both sides can agree on: lower case, runs of
 * anything that is not a letter or digit collapsed to one space. Launchers
 * write folder names ("Need for Speed™ Heat", "Star Wars Jedi: Fallen
 * Order") and the catalog carries the same games with different punctuation;
 * the marks and spacing are decoration on both sides, so they fall away and
 * what is left is the name.
 */
const normalizeTitle = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** First catalog game under each folded title - two entries for the same
 * name is a library question, not an import question, so first wins. */
const gamesByTitle = computed(() => {
  const map = new Map<string, { id: string; mName: string }>();
  for (const game of gameChoices.value) {
    const key = normalizeTitle(game.mName);
    if (!map.has(key)) map.set(key, game);
  }
  return map;
});

/** The catalog game a detected install's folder name names, when there is
 * one. A match means the import publishes a new version of the game it
 * belongs to instead of a near-identical row beside it. */
const matchedGame = (install: DetectedInstall) =>
  gamesByTitle.value.get(normalizeTitle(install.title));

/** Providers whose depot copies the server keeps current itself, pulling
 * new builds from the store: here, a launcher copy is a one-time seed. The
 * rest - EA, Rockstar, Steam - have no server-side acquisition, so their
 * launcher copy is what the depot updates from and Resync is the path. */
const NODE_UPDATED = new Set(["gog", "epic", "ubi"]);
const nodeUpdated = (install: DetectedInstall) =>
  NODE_UPDATED.has(install.launcher);

/**
 * Whether a launcher's copy normally starts on its own. GOG is DRM-free and
 * Epic builds run anonymously unless the publisher says otherwise, so both
 * default to direct exec; EA, Rockstar, Ubisoft and Steam builds authenticate
 * through their client, so their copies default to handoff. A self-starting
 * crack of a launcher-gated title is exactly why this is only the default -
 * the form's checkbox is where the player corrects it for the bytes they own.
 */
const STANDALONE_LAUNCHERS = new Set(["gog", "epic"]);
const standaloneByLauncher = (launcher: string) =>
  STANDALONE_LAUNCHERS.has(launcher);

const canStart = computed(
  () => folder.value !== "" && title.value.trim() !== "",
);

/** What the storefronts on this machine report installing. Detection reads
 * the files a launcher left behind, so it is cheap and it works offline. */
const detected = ref<DetectedInstall[]>([]);

/** Prefixes outside Drop's own `pfx` directory - a Lutris or Proton prefix
 * the player pointed at for this session. */
const extraPrefixes = ref<string[]>([]);

async function loadDetected() {
  try {
    detected.value = await detectLauncherInstalls(extraPrefixes.value);
  } catch (e) {
    console.warn("launcher install detection failed:", e);
    detected.value = [];
  }
}

void loadDetected();

async function scanAnotherPrefix() {
  const picked = await open({
    multiple: false,
    directory: true,
    canCreateDirectories: false,
  });
  if (typeof picked !== "string") return;
  if (!extraPrefixes.value.includes(picked)) extraPrefixes.value.push(picked);
  await loadDetected();
}

function chooseInstall(install: DetectedInstall) {
  folder.value = install.folder;
  title.value = install.title;
  runsStandalone.value = standaloneByLauncher(install.launcher);
}

/** A matched install needs no form: the library already knows the game, so
 * the press publishes a new version under it right away. A resync of
 * unchanged files plans zero uploads, so pressing it on a game that did not
 * move costs one scan and nothing else. */
function resyncInstall(install: DetectedInstall) {
  const game = matchedGame(install);
  if (!game) return;
  void start({
    folder: install.folder,
    gameTitle: game.mName,
    gameId: game.id,
    runsStandalone: standaloneByLauncher(install.launcher),
  }).catch((e) => (startError.value = String(e)));
}

/** Play the launcher's copy in place, or stop it. Any refusal (no umu, no
 * Proton, a folder that moved) lands in the same error line as a failed
 * import: same page, same meaning - nothing started. */
async function togglePlay(install: DetectedInstall) {
  if (playing.value.includes(install.folder)) {
    await stopPlay(install.folder).catch(() => undefined);
    return;
  }
  try {
    await play({
      folder: install.folder,
      executable: install.executable,
      prefix: install.prefix,
      gameId: matchedGame(install)?.id,
      steamAppId: install.launcher === "steam" ? install.installKey : undefined,
    });
  } catch (e) {
    startError.value = String(e);
  }
}

/** How the last whole-library import ended, in one line. */
const batchSummary = ref<string | null>(null);

async function importAllDetected() {
  if (!detected.value.length || batching.value) return;
  batchSummary.value = null;
  const outcomes = await importMany(
    detected.value.map((install) => {
      const game = matchedGame(install);
      return {
        folder: install.folder,
        // Under a match the catalog's own name carries the job; the folder
        // name only ever describes an install the library has never heard of.
        gameTitle: game?.mName ?? install.title,
        gameId: game?.id,
        runsStandalone: standaloneByLauncher(install.launcher),
      };
    }),
  );
  const published = outcomes.filter((outcome) => outcome.result.ok);
  const failures = outcomes.filter((outcome) => !outcome.result.ok);
  batchSummary.value = failures.length
    ? `${published.length} published, ${failures.length} not: ${failures
        .map(
          (failure) =>
            `${failure.input.gameTitle} (${failure.result.error ?? "cancelled"})`,
        )
        .join("; ")}`
    : `${published.length} published`;
}

async function pickFolder() {
  const picked = await open({
    multiple: false,
    directory: true,
    canCreateDirectories: false,
  });
  if (typeof picked === "string") folder.value = picked;
}

async function startImport() {
  if (!canStart.value) return;
  startError.value = null;
  try {
    await start({
      folder: folder.value,
      gameTitle: title.value.trim(),
      appVersion: appVersion.value.trim() || undefined,
      gameId: gameId.value || undefined,
      runsStandalone: runsStandalone.value,
    });
  } catch (e) {
    startError.value = String(e);
  }
}

function humanBytes(bytes: number) {
  return `${formatKilobytes(bytes / 1024)}B`;
}
</script>
