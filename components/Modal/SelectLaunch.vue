<template>
  <ModalTemplate v-model="open">
    <template #default>
      <div>
        <h1 as="h3" class="text-lg font-medium leading-6 text-white">
          Select a launch option
        </h1>
        <p class="mt-1 text-zinc-400 text-sm">
          Select a launch option as an executor for your new launch option.
        </p>
        <div
          v-if="props.filterPlatform"
          class="inline-flex items-center mt-2 gap-x-4"
        >
          <h1 class="block text-sm font-medium leading-6 text-zinc-100">
            Only showing launches for:
          </h1>
          <span class="flex items-center">
            <component
              :is="PLATFORM_ICONS[props.filterPlatform]"
              alt=""
              class="size-5 flex-shrink-0 text-blue-600"
            />
            <span class="ml-2 block truncate text-zinc-100 text-sm font-bold">{{
              props.filterPlatform
            }}</span>
          </span>
        </div>
      </div>
      <div class="mt-2 space-y-4">
        <div>
          <h1 class="block text-sm font-medium leading-6 text-zinc-100">
            Search for an executor
          </h1>
          <SelectorGame
            :search="search"
            :model-value="game"
            class="w-full mt-2"
            @update:model-value="(value) => updateGame(value)"
          />
        </div>
        <div
          v-if="versions !== undefined && Object.entries(versions).length == 0"
          class="text-zinc-300 text-sm font-bold font-display uppercase text-center w-full"
        >
          No versions imported.
        </div>
        <div v-else-if="versions !== undefined">
          <h1 class="block text-sm font-medium leading-6 text-zinc-100">
            Select a version
          </h1>
          <SelectorCombox
            :search="
              (v) =>
                Object.values(versions!)
                  .filter((k) =>
                    (k.displayName || k.versionPath)!
                      .toLowerCase()
                      .includes(v.toLowerCase()),
                  )
                  .map((v) => ({
                    id: v.versionId,
                    name: (v.displayName ?? v.versionPath)!,
                  }))
            "
            :display="(v) => v.name"
            :model-value="version"
            class="w-full mt-2"
            @update:model-value="updateVersion"
          >
            <template #default="{ value }">
              {{ value.name }}
            </template>
          </SelectorCombox>
        </div>
        <div v-if="versions && version">
          <h1 class="block text-sm font-medium leading-6 text-zinc-100">
            Select a launch command
          </h1>
          <SelectorCombox
            :search="
              (v) =>
                versions![version!.id].launches
                  .filter(
                    (k) =>
                      (k.name || k.command)
                        .toLowerCase()
                        .includes(v.toLowerCase()) &&
                      (props.filterPlatform
                        ? k.platform == props.filterPlatform
                        : true),
                  )
                  .map((v) => ({
                    id: v.launchId,
                    ...v,
                  }))
            "
            :display="(v) => v.name"
            :model-value="launchId"
            class="w-full mt-2"
            @update:model-value="(v) => (launchId = v)"
          >
            <template #default="{ value }">
              <div class="flex flex-col">
                <span class="text-zinc-300 text-sm">
                  {{ value.name }}
                </span>
                <span class="text-zinc-400 text-xs">{{ value.command }}</span>
              </div>
            </template>
          </SelectorCombox>
        </div>
      </div>

      <div v-if="error" class="mt-3 rounded-md bg-red-600/10 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <XCircleIcon class="h-5 w-5 text-red-600" aria-hidden="true" />
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-600">
              {{ error }}
            </h3>
          </div>
        </div>
      </div>
    </template>
    <template #buttons>
      <LoadingButton :loading="false" :disabled="!launchId" @click="submit">
        Select
      </LoadingButton>
      <button
        class="inline-flex items-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold font-display text-white hover:bg-zinc-700"
        @click="() => (open = false)"
      >
        {{ $t("cancel") }}
      </button>
    </template>
  </ModalTemplate>
</template>

<script setup lang="ts">
import { XCircleIcon } from "@heroicons/vue/24/outline";
import type { ExecutorLaunchObject } from "~/composables/frontend";
import type { Platform } from "~/prisma/client/enums";
import type { GameMetadataSearchResult } from "~/server/internal/metadata/types";

const props = defineProps<{ filterPlatform?: Platform }>();

const open = defineModel<boolean>({ required: true });

const error = ref<string | undefined>();
const game = ref<GameMetadataSearchResult | undefined>(undefined);
const version = ref<{ id: string; name: string } | undefined>(undefined);
const launchId = ref<
  { id: string; name: string; command: string; platform: Platform } | undefined
>(undefined);

const versions = ref<
  | {
      [key: string]: {
        displayName: string | null;
        launches: {
          launchId: string;
          command: string;
          name: string;
          platform: Platform;
        }[];
        versionId: string;
        versionPath: string | null;
      };
    }
  | undefined
>(undefined);

const emit = defineEmits<{
  select: [data: ExecutorLaunchObject];
}>();

async function search(query: string) {
  return await $dropFetch("/api/v1/admin/search/game", {
    query: { q: query, type: "Executor" },
  });
}

function updateGame(value: GameMetadataSearchResult | undefined) {
  if (game.value !== value || value == undefined) {
    version.value = undefined;
    versions.value = undefined;
    launchId.value = undefined;
  }

  game.value = value;

  if (game.value) fetchVersions();
}

async function fetchVersions() {
  const newVersions = await $dropFetch("/api/v1/admin/game/:id/versions", {
    params: { id: game.value!.id },
    failTitle: "Failed to fetch versions for launch picker",
  });
  versions.value = Object.fromEntries(newVersions.map((v) => [v.versionId, v]));
}

function updateVersion(v: typeof version.value) {
  if (version.value !== v || v == undefined) {
    launchId.value = undefined;
  }
  version.value = v;
}

function submit() {
  emit("select", {
    launchId: launchId.value!.id,
    gameName: game.value!.name,
    gameIcon: game.value!.icon,
    versionName: version.value!.name,
    launchName: launchId.value!.name,
    platform: launchId.value!.platform,
  });
  open.value = false;
}

watch(open, () => {
  game.value = undefined;
  updateGame(game.value);
});
</script>
