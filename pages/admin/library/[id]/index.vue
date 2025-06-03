<!-- eslint-disable vue/no-v-html -->
<template>
  <div>
    <div
      v-if="game && unimportedVersions !== undefined"
      class="grow flex flex-col gap-y-8"
    >
      <div
        class="grow w-full h-full lg:pr-[30vw] px-6 py-4 flex flex-col"
      >
        <div v-if="game.versions.length === 0" class="flex flex-col items-center justify-center h-full text-zinc-400">
          <InformationCircleIcon class="w-12 h-12 mb-2 text-zinc-400" />
          <div class="font-semibold text-lg">No versions yet</div>
          <div class="text-sm mt-1">Import your first version to get started!</div>
        </div>
      </div>
      <div
        class="lg:overflow-y-auto lg:border-l lg:border-zinc-800 lg:fixed lg:inset-y-0 lg:z-50 lg:w-[30vw] flex flex-col lg:right-0 gap-y-8 px-6 py-4"
      >
        <!-- toolbar -->
        <div class="inline-flex justify-end items-stretch gap-x-4">
          <!-- open in library button -->
          <NuxtLink
            :href="`/admin/metadata/games/${game.id}`"
            type="button"
            class="inline-flex w-fit items-center gap-x-2 rounded-md bg-zinc-800 px-3 py-1 text-sm font-semibold font-display text-white shadow-sm transition-all duration-200 hover:bg-zinc-700 hover:scale-105 hover:shadow-lg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Open in Metadata
            <ArrowTopRightOnSquareIcon
              class="-mr-0.5 h-7 w-7 p-1"
              aria-hidden="true"
            />
          </NuxtLink>
          <!-- open in store button -->
          <NuxtLink
            :href="`/store/${game.id}`"
            type="button"
            class="inline-flex w-fit items-center gap-x-2 rounded-md bg-zinc-800 px-3 py-1 text-sm font-semibold font-display text-white shadow-sm transition-all duration-200 hover:bg-zinc-700 hover:scale-105 hover:shadow-lg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Open in Store
            <ArrowTopRightOnSquareIcon
              class="-mr-0.5 h-7 w-7 p-1"
              aria-hidden="true"
            />
          </NuxtLink>
        </div>

        <!-- version manager -->
        <div>
          <!-- version priority -->
          <div>
            <div class="border-b border-zinc-800 pb-3">
              <div
                class="flex flex-wrap items-center justify-between sm:flex-nowrap"
              >
                <h3
                  class="text-base font-semibold font-display leading-6 text-zinc-100"
                >
                  Version priority

                  <!-- import games button -->

                  <NuxtLink
                    v-if="unimportedVersions !== undefined"
                    :href="
                      unimportedVersions.length > 0
                        ? `/admin/library/${game.id}/import`
                        : ''
                    "
                    type="button"
                    :class="[
                      unimportedVersions.length > 0
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-blue-800/50',
                      'inline-flex w-fit items-center gap-x-2 rounded-md  px-3 py-1 text-sm font-semibold font-display text-white shadow-sm  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
                    ]"
                  >
                    {{
                      unimportedVersions.length > 0
                        ? "Import version"
                        : "No versions to import"
                    }}
                  </NuxtLink>
                </h3>
              </div>
            </div>

            <div class="mt-4 text-center w-full text-sm text-zinc-600">
              lowest
            </div>
            <draggable
              :list="game.versions"
              handle=".handle"
              class="mt-2 space-y-4"
              @update="() => updateVersionOrder()"
            >
              <template #item="{ element: item }: { element: GameVersion }">
                <div
                  class="w-full inline-flex items-center px-4 py-2 bg-zinc-800 rounded justify-between"
                >
                  <div class="text-zinc-100 font-semibold">
                    {{ item.versionName }}
                  </div>
                  <div class="text-zinc-400">
                    {{ item.delta ? "Upgrade mode" : "" }}
                  </div>
                  <div class="inline-flex items-center gap-x-2">
                    <component
                      :is="PLATFORM_ICONS[item.platform]"
                      class="size-6 text-blue-600"
                    />
                    <Bars3Icon
                      class="cursor-move w-6 h-6 text-zinc-400 handle"
                    />
                    <button @click="() => deleteVersion(item.versionName)">
                      <TrashIcon class="w-5 h-5 text-red-600" />
                    </button>
                  </div>
                </div>
              </template>
            </draggable>
            <div
              v-if="game.versions.length == 0"
              class="text-center font-bold text-zinc-400 my-3"
            >
              no versions added
            </div>
            <div class="mt-2 text-center w-full text-sm text-zinc-600">
              highest
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GameVersion } from "~/prisma/client";
import {
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  TrashIcon,
  InformationCircleIcon,
} from "@heroicons/vue/24/solid";

definePageMeta({
  layout: "admin",
});

// TODO implement UI for this

const route = useRoute();
const gameId = route.params.id.toString();
const { game: rawGame, unimportedVersions } = await $dropFetch(
  `/api/v1/admin/game?id=${encodeURIComponent(gameId)}`,
);
const game = ref(rawGame);

async function updateVersionOrder() {
  try {
    const newVersions = await $dropFetch("/api/v1/admin/game/version", {
      method: "PATCH",
      body: {
        id: gameId,
        versions: game.value.versions.map((e) => e.versionName),
      },
    });
    game.value.versions = newVersions;
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: "There an error while updating the version order",
        description: `Drop encountered an error while updating the version: ${
          // @ts-expect-error attempt to get statusMessage on error
          e?.statusMessage ?? "An unknown error occurred"
        }`,
        buttonText: "Close",
      },
      (e, c) => c(),
    );
  }
}

async function deleteVersion(versionName: string) {
  try {
    await $dropFetch("/api/v1/admin/game/version", {
      method: "DELETE",
      body: {
        id: gameId,
        versionName: versionName,
      },
    });
    game.value.versions.splice(
      game.value.versions.findIndex((e) => e.versionName === versionName),
      1,
    );
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: "There an error while deleting the version",
        description: `Drop encountered an error while deleting the version: ${
          // @ts-expect-error attempt to get statusMessage on error
          e?.statusMessage ?? "An unknown error occurred"
        }`,
        buttonText: "Close",
      },
      (e, c) => c(),
    );
  }
}
</script>
