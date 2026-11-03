<template>
  <div class="mx-auto w-full max-w-6xl space-y-8 text-ink-100">
    <header
      class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p
          class="text-xs font-semibold uppercase tracking-[0.18em] text-accent-400"
        >
          Admin · Saves
        </p>
        <h1 class="mt-2 text-3xl font-semibold tracking-tight">Cloud saves</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-ink-400">
          Every save slot the server holds, with what it costs. Versions are
          immutable history: deleting one drops a snapshot, deleting a slot
          drops its whole timeline.
        </p>
      </div>
      <button
        type="button"
        class="inline-flex w-fit items-center gap-2 rounded-lg border border-surface-700 px-3 py-2 text-sm font-medium text-ink-200 transition hover:border-surface-600"
        :disabled="loading"
        @click="load()"
      >
        <ArrowPathIcon class="size-4" :class="loading ? 'animate-spin' : ''" />
        Refresh
      </button>
    </header>

    <!-- Quota: the same limit the clients are told about. -->
    <section class="rounded-xl border border-surface-700 bg-surface-800 p-5">
      <div class="flex items-baseline justify-between gap-4">
        <h2 class="text-base font-semibold">Storage per user</h2>
        <p class="text-sm text-ink-400">
          <span v-if="quotaMb > 0">Limit {{ quotaMb }} MB</span>
          <span v-else>No limit set</span>
        </p>
      </div>
      <p v-if="users.length === 0" class="mt-4 text-sm text-ink-400">
        No save history on this server yet.
      </p>
      <ul v-else class="mt-4 space-y-3">
        <li v-for="user in users" :key="user.userId" class="space-y-1.5">
          <div class="flex items-baseline justify-between gap-4 text-sm">
            <span class="font-medium text-ink-100">{{ user.username }}</span>
            <span class="text-ink-400">
              {{ formatBytes(user.usedBytes) }} ·
              {{ user.versionCount }} version{{
                user.versionCount === 1 ? "" : "s"
              }}
            </span>
          </div>
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-700">
            <div
              class="h-full rounded-full"
              :class="overQuota(user) ? 'bg-red-500' : 'bg-accent-500'"
              :style="{ width: usageShare(user) + '%' }"
            />
          </div>
        </li>
      </ul>
    </section>

    <!-- Slots: one row per (owner, player, game, slot). -->
    <section class="space-y-3">
      <div class="flex items-baseline justify-between gap-4">
        <h2 class="text-base font-semibold">
          Save slots
          <span class="ml-1 text-sm font-normal text-ink-400">
            {{ slots.length }}
          </span>
        </h2>
        <label class="flex items-center gap-2 text-sm text-ink-400">
          Owner
          <select
            v-model="ownerFilter"
            class="rounded-md border border-surface-700 bg-surface-800 px-2 py-1 text-sm text-ink-100"
            @change="load()"
          >
            <option value="">All users</option>
            <option
              v-for="user in users"
              :key="user.userId"
              :value="user.userId"
            >
              {{ user.username }}
            </option>
          </select>
        </label>
      </div>

      <p v-if="slots.length === 0" class="text-sm text-ink-400">
        Nothing to show for this filter.
      </p>

      <article
        v-for="slot in slots"
        :key="slotKey(slot)"
        class="rounded-xl border border-surface-700 bg-surface-800"
      >
        <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <button
            type="button"
            class="flex flex-1 items-center gap-4 text-left"
            @click="toggle(slot)"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-ink-100">
                {{ slot.game }}
                <span class="text-ink-400">· slot {{ slot.index + 1 }}</span>
                <span v-if="slot.label" class="text-ink-400">
                  · {{ slot.label }}</span
                >
              </span>
              <span class="mt-0.5 block truncate text-xs text-ink-400">
                {{ slot.username }} · {{ slot.profile }} ·
                {{ slot.versionCount }} version{{
                  slot.versionCount === 1 ? "" : "s"
                }}
                · head {{ formatBytes(slot.headSizeBytes) }} ·
                {{ new Date(slot.updatedAt).toLocaleString() }}
              </span>
            </span>
            <span class="w-32 shrink-0">
              <span class="block text-right text-xs text-ink-300">
                {{ formatBytes(slot.totalBytes) }}
              </span>
              <span
                class="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-surface-700"
              >
                <span
                  class="block h-full rounded-full bg-accent-400"
                  :style="{ width: slotShare(slot) + '%' }"
                />
              </span>
            </span>
          </button>

          <div class="flex shrink-0 items-center gap-2">
            <a
              v-if="slot.headVersionId"
              :href="versionDownloadUrl(slot.headVersionId)"
              class="rounded-md border border-surface-700 px-2.5 py-1.5 text-xs font-medium text-ink-200 hover:border-accent-500 hover:text-accent-300"
              >Download head</a
            >
            <button
              type="button"
              class="rounded-md border border-surface-700 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:border-red-500 hover:text-red-200"
              @click="deleteSlot(slot)"
            >
              Delete slot
            </button>
          </div>
        </div>

        <!-- Timeline: opened on demand, because the list is the working view. -->
        <div
          v-if="opened === slotKey(slot)"
          class="border-t border-surface-700"
        >
          <p v-if="detailLoading" class="px-4 py-3 text-sm text-ink-400">
            Loading history…
          </p>
          <p v-else-if="detailError" class="px-4 py-3 text-sm text-red-300">
            {{ detailError }}
          </p>
          <ul v-else class="divide-y divide-surface-700">
            <li
              v-for="version in detail?.versions ?? []"
              :key="version.id"
              class="flex items-center gap-4 px-4 py-2.5"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm text-ink-100">
                  {{ new Date(version.createdAt).toLocaleString() }}
                  <span
                    v-if="isHead(version)"
                    class="ml-1 rounded bg-accent-500/20 px-1.5 py-0.5 text-xs font-medium text-accent-300"
                    >current</span
                  >
                  <span
                    v-if="version.pinned"
                    class="ml-1 rounded bg-surface-700 px-1.5 py-0.5 text-xs text-ink-300"
                    >pinned</span
                  >
                </span>
                <span class="mt-0.5 block truncate text-xs text-ink-400">
                  {{ version.kind }} ·
                  {{ formatBytes(version.sizeBytes ?? 0) }} ·
                  {{ version.fileCount ?? "?" }} file{{
                    (version.fileCount ?? 0) === 1 ? "" : "s"
                  }}
                  · {{ version.contentHash.slice(0, 12) }}
                </span>
              </span>
              <a
                :href="versionDownloadUrl(version.id)"
                class="shrink-0 rounded-md border border-surface-700 px-2.5 py-1.5 text-xs font-medium text-ink-200 hover:border-accent-500 hover:text-accent-300"
                >Download</a
              >
              <button
                type="button"
                class="shrink-0 rounded-md border border-surface-700 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:border-red-500 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="isHead(version)"
                :title="
                  isHead(version)
                    ? 'The current version stays until a newer one replaces it'
                    : 'Delete this version'
                "
                @click="deleteVersion(slot, version)"
              >
                Delete
              </button>
            </li>
          </ul>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ArrowPathIcon } from "@heroicons/vue/24/outline";
import { formatBytes } from "~/server/internal/utils/files";

definePageMeta({
  layout: "admin",
});

type UserUsage = {
  userId: string;
  username: string;
  usedBytes: number;
  versionCount: number;
};

type SlotRow = {
  gameId: string;
  game: string;
  userId: string;
  username: string;
  profileId: string;
  profile: string;
  index: number;
  label: string | null;
  updatedAt: string;
  versionCount: number;
  totalBytes: number;
  headSizeBytes: number;
  headVersionId: string | null;
};

type VersionRow = {
  id: string;
  createdAt: string;
  kind: string;
  sizeBytes: number | null;
  fileCount: number | null;
  contentHash: string;
  pinned: boolean;
};

const loading = ref(false);
const quotaMb = ref(0);
const users = ref<UserUsage[]>([]);
const slots = ref<SlotRow[]>([]);
const ownerFilter = ref("");

const opened = ref("");
const detail = ref<{ versions: VersionRow[]; headId: string | null } | null>(
  null,
);
const detailLoading = ref(false);
const detailError = ref("");

async function load() {
  loading.value = true;
  try {
    const data = await $dropFetch<{
      quotaMb: number;
      users: UserUsage[];
      slots: SlotRow[];
    }>("/api/v1/admin/saves", {
      query: ownerFilter.value ? { user: ownerFilter.value } : {},
    });
    quotaMb.value = data.quotaMb;
    users.value = data.users;
    slots.value = data.slots;
  } finally {
    loading.value = false;
  }
}

onMounted(() => load());

const slotKey = (slot: SlotRow) =>
  `${slot.gameId}|${slot.userId}|${slot.profileId}|${slot.index}`;
const versionDownloadUrl = (versionId: string) =>
  `/api/v1/admin/saves/version/${versionId}/download`;

/** Share of the per-user quota, or of the heaviest slot when unlimited. */
const usageShare = (user: UserUsage) => {
  const limitBytes = quotaMb.value * 1024 * 1024;
  if (limitBytes > 0)
    return Math.min(100, Math.round((user.usedBytes / limitBytes) * 100));
  const heaviest = Math.max(...users.value.map((u) => u.usedBytes), 1);
  return Math.round((user.usedBytes / heaviest) * 100);
};
const overQuota = (user: UserUsage) =>
  quotaMb.value > 0 && user.usedBytes >= quotaMb.value * 1024 * 1024;

const heaviestSlot = computed(() =>
  Math.max(...slots.value.map((slot) => slot.totalBytes), 1),
);
const slotShare = (slot: SlotRow) =>
  Math.min(100, Math.round((slot.totalBytes / heaviestSlot.value) * 100));

const isHead = (version: VersionRow) => detail.value?.headId === version.id;

async function toggle(slot: SlotRow) {
  const key = slotKey(slot);
  if (opened.value === key) {
    opened.value = "";
    detail.value = null;
    return;
  }
  opened.value = key;
  detail.value = null;
  detailError.value = "";
  detailLoading.value = true;
  try {
    const data = await $dropFetch<{
      slot: { head: { id: string } | null };
      versions: VersionRow[];
    }>(
      `/api/v1/admin/saves/slot/${slot.userId}/${slot.profileId}/${slot.gameId}/${slot.index}`,
    );
    detail.value = {
      versions: data.versions,
      headId: data.slot.head?.id ?? null,
    };
  } catch (e) {
    detailError.value =
      // @ts-expect-error ofetch carries statusMessage
      e?.statusMessage ?? e?.message ?? "Failed to load this slot";
  } finally {
    detailLoading.value = false;
  }
}

async function remove(url: string, question: string, describe: string) {
  const confirmed = await new Promise<boolean>((resolve) =>
    createModal(
      ModalType.Confirmation,
      {
        title: "Delete save data",
        description: question,
        buttonText: "Delete",
      },
      (event, close) => {
        resolve(event === "confirm");
        close();
      },
    ),
  );
  if (!confirmed) return;
  try {
    await $dropFetch(url, { method: "DELETE" });
    await load();
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: `Could not delete ${describe}`,
        description:
          // @ts-expect-error ofetch carries statusMessage
          e?.statusMessage ?? e?.message ?? "Unknown error",
      },
      (_, close) => close(),
    );
    // The head may have moved while this dialog was open; show the truth.
    await load();
  }
}

function deleteSlot(slot: SlotRow) {
  void remove(
    `/api/v1/admin/saves/slot/${slot.userId}/${slot.profileId}/${slot.gameId}/${slot.index}`,
    `Delete ${slot.game} slot ${slot.index + 1} for ${slot.username} (${slot.profile}), including all ${slot.versionCount} versions?`,
    "the save slot",
  );
  opened.value = "";
}

function deleteVersion(slot: SlotRow, version: VersionRow) {
  void remove(
    `/api/v1/admin/saves/version/${version.id}`,
    `Delete this ${formatBytes(version.sizeBytes ?? 0)} snapshot of ${slot.game} (${slot.username})? The rest of the timeline stays.`,
    "the save version",
  );
}
</script>
