<template>
  <div class="border-b border-zinc-700 py-5">
    <h3 class="text-base font-semibold font-display leading-6 text-zinc-100">
      Players
    </h3>
  </div>

  <div class="mt-5 flex flex-col gap-4">
    <div class="flex flex-row items-center justify-between">
      <div>
        <h3 class="text-sm font-medium leading-6 text-zinc-100">
          Add a player
        </h3>
        <p class="mt-1 text-sm leading-6 text-zinc-400">
          Each player keeps their own play stats and cloud saves on this
          account.
        </p>
      </div>
      <button
        @click="askCreate"
        type="button"
        class="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Add player
      </button>
    </div>

    <div v-if="error" class="rounded-md bg-red-600/10 p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <XCircleIcon class="h-5 w-5 text-red-600" aria-hidden="true" />
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-600">{{ error }}</h3>
        </div>
      </div>
    </div>

    <ul class="divide-y divide-zinc-800">
      <li
        v-for="profile in profiles"
        :key="profile.id"
        class="flex items-center justify-between gap-x-4 py-3"
      >
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-x-2">
            <span class="text-sm font-medium text-zinc-100">{{
              profile.name
            }}</span>
            <span
              v-if="profile.id === activeId"
              class="rounded bg-blue-500/20 px-1.5 py-0.5 text-xs font-medium text-blue-300"
              >playing</span
            >
            <span
              v-if="profile.isDefault"
              class="rounded bg-zinc-700/60 px-1.5 py-0.5 text-xs font-medium text-zinc-300"
              >default</span
            >
          </div>
          <p class="mt-0.5 text-xs text-zinc-500">
            Added {{ new Date(profile.createdAt).toLocaleDateString() }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-x-1 text-xs font-medium">
          <button
            v-if="profile.id !== activeId"
            class="rounded-md px-2 py-1 text-zinc-400 transition hover:bg-zinc-900/60 hover:text-zinc-100 disabled:opacity-40"
            :disabled="busy"
            @click="makeActive(profile.id)"
          >
            Play as this player
          </button>
          <button
            class="rounded-md px-2 py-1 text-zinc-400 transition hover:bg-zinc-900/60 hover:text-zinc-100"
            @click="askRename(profile)"
          >
            Rename
          </button>
        </div>
      </li>
    </ul>

    <p class="text-sm text-zinc-500">
      Removing a player would also remove their play stats and save history,
      so players are kept for good.
    </p>
  </div>
</template>

<script setup lang="ts">
import { XCircleIcon } from "@heroicons/vue/16/solid";
import type { Profile } from "~/composables/profiles";

const error = ref<string | null>(null);
const busy = ref(false);

const { profiles, activeId, refresh, setActive, createProfile, renameProfile } =
  useProfiles();

onMounted(() => {
  void refresh();
});

const guard = async (fn: () => Promise<void>) => {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    await fn();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
};

const askCreate = () => {
  createModal(
    ModalType.TextInput,
    {
      title: "Add a player",
      description:
        "Their name shows on this device and labels their stats and saves.",
      placeholder: "Player name",
      buttonText: "Add",
    },
    async (event, close, name: string) => {
      if (event !== "submit" || !name?.trim()) return;
      await guard(async () => {
        await createProfile(name.trim());
      });
      close();
    },
  );
};

const askRename = (profile: Profile) => {
  createModal(
    ModalType.TextInput,
    {
      title: `Rename ${profile.name}`,
      description: "Play stats and saves ride through a rename unchanged.",
      dft: profile.name,
      buttonText: "Rename",
    },
    async (event, close, name: string) => {
      if (event !== "submit" || !name?.trim() || name.trim() === profile.name)
        return;
      await guard(async () => {
        await renameProfile(profile.id, name.trim());
      });
      close();
    },
  );
};

const makeActive = (id: string) =>
  guard(async () => {
    await setActive(id);
  });
</script>
