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
          <button
            type="button"
            class="shrink-0 rounded-md bg-surface-700 px-2.5 py-1.5 text-xs font-semibold text-ink-100 hover:bg-surface-600"
            @click="chooseInstall(install)"
          >
            Choose
          </button>
        </li>
      </ul>
      <p class="mt-1 text-sm text-ink-400">
        Check the folder and the title before publishing: what the launcher
        called a folder is not always what the catalog should call a game.
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
  type DetectedInstall,
} from "~/composables/imports";

const appState = useAppState();
const isAdmin = computed(() => appState.value?.user?.admin ?? false);

const { jobs, start, cancel } = useImports();

const folder = ref("");
const title = ref("");
const appVersion = ref("");
const gameId = ref("");
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
    });
  } catch (e) {
    startError.value = String(e);
  }
}

function humanBytes(bytes: number) {
  return `${formatKilobytes(bytes / 1024)}B`;
}
</script>
