<script setup lang="ts">
import type {
  ConflictChoice,
  SaveSyncOutcome,
  SaveVersion,
} from "~/composables/saves";

const props = defineProps<{ gameId: string }>();

const { versions, outcome, loading, load } = useSaves(props.gameId);

const busy = ref(false);
const conflictOpen = ref(false);
const conflictChoice = ref<ConflictChoice | undefined>(undefined);

// The engine asks, it never decides: a conflict outcome opens the dialog,
// and only a resolve answer (a later non-conflict outcome) closes it.
watch(outcome, (current) => {
  if (!current) return;
  if (current.kind === "conflict") {
    conflictChoice.value = undefined;
    conflictOpen.value = true;
  } else {
    conflictOpen.value = false;
  }
});

onMounted(() => {
  // A conflict recorded before this page existed (the global hook pre-seeds
  // the registry) should open the dialog immediately.
  if (outcome.value?.kind === "conflict") {
    conflictChoice.value = undefined;
    conflictOpen.value = true;
  }
  void load();
});

const run = async (fn: () => Promise<unknown>) => {
  if (busy.value) return;
  busy.value = true;
  try {
    await fn();
  } catch (e) {
    outcome.value = { kind: "failed", stage: "command", error: String(e) };
  } finally {
    busy.value = false;
  }
};

const onSync = () =>
  run(async () => {
    const result = await syncGameSaves(props.gameId);
    // `null` means the game is not save-managed (no curated manifest or not
    // installed); the engine only emits events for managed games.
    if (result === null) outcome.value = { kind: "notManaged" };
  });

const onRestore = (version: SaveVersion) =>
  run(() => restoreSaveVersion(props.gameId, version.id));

const onPin = (version: SaveVersion) =>
  run(async () => {
    const updated = await setSaveVersionPinned(
      props.gameId,
      version.id,
      !version.pinned,
    );
    const index = versions.value.findIndex((v) => v.id === updated.id);
    if (index >= 0) versions.value[index] = updated;
  });

const onResolve = () => {
  const choice = conflictChoice.value;
  if (!choice) return;
  return run(async () => {
    await resolveSaveConflict(props.gameId, choice);
    conflictOpen.value = false;
  });
};

const conflictOptions: {
  value: ConflictChoice;
  label: string;
  description: string;
}[] = [
  {
    value: "keepBoth",
    label: "Keep both versions",
    description:
      "The server copy is pinned (never pruned) and this device's save is uploaded on top. Both stay restorable from this list.",
  },
  {
    value: "keepLocal",
    label: "Use this device's save",
    description:
      "This device's save becomes the current one. The server copy stays in the timeline below.",
  },
  {
    value: "keepServer",
    label: "Use the server's save",
    description:
      "Overwrites this device's save files with the server's current version.",
  },
];

const outcomeText = computed(() => {
  const current: SaveSyncOutcome | undefined = outcome.value;
  if (!current) return "";
  switch (current.kind) {
    case "notManaged":
      return "This game's saves are not managed yet — no curated save layout exists for it.";
    case "clean":
      return "Saves are in sync with the server.";
    case "pushed":
      return `Backed up ${current.fileCount} save file${current.fileCount === 1 ? "" : "s"}.`;
    case "pulled":
      return `Restored ${current.written} save file${current.written === 1 ? "" : "s"} from the server.`;
    case "conflict":
      return "This device and the server each changed the save since the last sync.";
    case "failed":
      return `Sync failed: ${current.error}`;
  }
});

const outcomeStyle = computed(() => {
  switch (outcome.value?.kind) {
    case "pushed":
    case "pulled":
    case "clean":
      return "text-green-400";
    case "conflict":
      return "text-amber-400";
    case "failed":
      return "text-red-400";
    default:
      return "text-ink-500";
  }
});

const kindLabels: Partial<Record<SaveVersion["kind"], string>> = {
  Restore: "restored",
  ConflictKeepLocal: "conflict copy",
  Import: "imported",
  Legacy: "legacy",
  Safety: "safety copy",
};

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const formatBytes = (bytes?: number) => {
  if (bytes === undefined) return "size unknown";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
};
</script>

<template>
  <div class="bg-surface-800/50 rounded-xl p-6 backdrop-blur-sm">
    <div class="mb-4 flex items-center justify-between gap-x-4">
      <h2 class="text-xl font-display font-semibold text-ink-100">Saves</h2>
      <LoadingButton :loading="busy" :disabled="busy" @click="onSync">
        Sync now
      </LoadingButton>
    </div>

    <div v-if="outcomeText" class="mb-4 flex items-start gap-x-2">
      <p class="text-sm" :class="outcomeStyle">{{ outcomeText }}</p>
      <button
        v-if="outcome?.kind === 'conflict'"
        class="shrink-0 text-sm font-medium text-accent-400 hover:text-accent-300"
        @click="conflictOpen = true"
      >
        Resolve
      </button>
    </div>

    <div
      v-if="versions.length === 0 && !loading"
      class="text-sm text-ink-500"
    >
      No backups yet — saves upload automatically when you exit the game.
    </div>

    <ul v-else class="-my-1 divide-y divide-surface-800/60">
      <li
        v-for="(version, index) in versions"
        :key="version.id"
        class="flex items-center justify-between gap-x-4 py-2.5"
      >
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="text-sm text-ink-100">{{
              formatWhen(version.createdAt)
            }}</span>
            <span
              v-if="index === 0"
              class="rounded bg-accent-500/20 px-1.5 py-0.5 text-xs font-medium text-accent-300"
              >current</span
            >
            <span
              v-if="version.pinned"
              class="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-300"
              >pinned</span
            >
            <span
              v-if="kindLabels[version.kind]"
              class="rounded bg-surface-700/60 px-1.5 py-0.5 text-xs font-medium text-ink-300"
              >{{ kindLabels[version.kind] }}</span
            >
          </div>
          <p class="mt-0.5 text-xs text-ink-500">
            {{ version.fileCount ?? "?" }} file{{
              version.fileCount === 1 ? "" : "s"
            }}
            · {{ formatBytes(version.sizeBytes) }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-x-1 text-xs font-medium">
          <button
            class="rounded-md px-2 py-1 text-ink-400 transition hover:bg-surface-900/60 hover:text-ink-100"
            @click="onPin(version)"
          >
            {{ version.pinned ? "Unpin" : "Pin" }}
          </button>
          <button
            class="rounded-md px-2 py-1 text-ink-400 transition hover:bg-surface-900/60 hover:text-ink-100 disabled:opacity-40 disabled:hover:bg-transparent"
            :disabled="index === 0 || busy"
            @click="onRestore(version)"
          >
            Restore
          </button>
        </div>
      </li>
    </ul>

    <p v-if="loading" class="mt-3 text-xs text-ink-500">Loading timeline…</p>
  </div>

  <ModalTemplate v-model="conflictOpen">
    <template #default>
      <div class="text-left">
        <h3 class="text-base font-semibold text-ink-100">Save conflict</h3>
        <p class="mt-1 text-sm text-ink-400">
          Nothing has been overwritten. Choose which save to keep — versions
          are immutable, so a copy left in the timeline can always be
          restored later.
        </p>
        <div class="mt-4 space-y-2">
          <button
            v-for="option in conflictOptions"
            :key="option.value"
            class="w-full rounded-lg border p-3 text-left transition"
            :class="
              conflictChoice === option.value
                ? 'border-accent-500 bg-accent-500/10'
                : 'border-surface-700 hover:border-surface-500'
            "
            @click="conflictChoice = option.value"
          >
            <p class="text-sm font-medium text-ink-100">
              {{ option.label }}
            </p>
            <p class="mt-0.5 text-xs text-ink-400">
              {{ option.description }}
            </p>
          </button>
        </div>
      </div>
    </template>
    <template #buttons="{ close }">
      <LoadingButton
        :loading="busy"
        :disabled="busy || !conflictChoice"
        @click="onResolve"
      >
        Apply
      </LoadingButton>
      <button
        class="rounded-md px-3 py-1.5 text-sm font-semibold leading-6 text-ink-300 transition hover:bg-surface-700/60 hover:text-ink-100"
        @click="close"
      >
        Decide later
      </button>
    </template>
  </ModalTemplate>
</template>
