<!-- eslint-disable vue/no-v-html -->
<template>
  <div v-if="game" class="h-full grow flex flex-row gap-y-8">
    <div class="grow w-full h-full px-6 py-4 flex flex-col gap-8">
      <!-- version manager -->

      <div class="rounded-lg bg-zinc-950 shadow-sm divide-y divide-zinc-800">
        <div class="px-4 py-3 sm:px-6">
          <h1
            class="w-full inline-flex items-center justify gap-x-2 text-lg text-zinc-200 font-semibold"
          >
            <ServerStackIcon class="size-5" />
            {{ $t("library.admin.versionPriority.title") }}
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
                'ml-auto inline-flex w-fit items-center gap-x-2 rounded-md px-3 py-1.5 text-sm font-semibold font-display text-white shadow-sm  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
              ]"
            >
              {{
                unimportedVersions.length > 0
                  ? $t("library.admin.import.version.import")
                  : $t("library.admin.import.version.noVersions")
              }}
            </NuxtLink>
          </h1>
          <p class="text-sm text-zinc-400">
            {{ $t("library.admin.versionPriority.description") }}
          </p>
        </div>
        <div class="bg-zinc-950/10 px-4 py-5 sm:p-6">
          <!-- version priority -->
          <div>
            <div class="text-center w-full text-sm text-zinc-600">
              {{ $t("lowest") }}
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
                    {{ item.delta ? $t("library.admin.version.delta") : "" }}
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
              {{ $t("library.admin.version.noVersionsAdded") }}
            </div>
            <div class="mt-2 text-center w-full text-sm text-zinc-600">
              {{ $t("highest") }}
            </div>
          </div>
        </div>
      </div>

      <!-- cloud saves manager -->
      <div class="rounded-lg bg-zinc-950 shadow-sm divide-y divide-zinc-800">
        <div class="px-4 py-3 sm:px-6">
          <h1
            class="w-full inline-flex items-center justify gap-x-2 text-lg text-zinc-200 font-semibold"
          >
            <CloudIcon class="size-5" />
            {{ $t("library.admin.cloudSaves.title") }}
          </h1>
          <p class="text-sm text-zinc-400">
            {{ $t("library.admin.cloudSaves.description") }}
          </p>
        </div>
        <div class="bg-zinc-950/10 px-4 py-5 sm:p-6">
          <LudusaviSearchbar
            :default="game.cloudSaveConfiguration?.ludusaviEntry?.name"
            @update="(name) => updateLudusaviEntry(name)"
          />
          <dl
            v-if="game.cloudSaveConfiguration?.ludusaviEntry"
            class="mt-4 grid grid-cols-1 gap-0.5 overflow-hidden rounded-2xl text-center sm:grid-cols-3"
          >
            <div
              v-for="stat in [
                { name: 'Name', value: game.cloudSaveConfiguration.ludusaviEntry.name },
                { name: 'Steam ID', value: game.cloudSaveConfiguration.ludusaviEntry.steamId },
              ]"
              :key="stat.name"
              class="flex flex-col bg-white/5 p-8"
            >
              <dt class="text-sm/6 font-semibold text-gray-300">
                {{ stat.name }}
              </dt>
              <dd
                class="order-first text-3xl font-semibold tracking-tight text-white"
              >
                {{ stat.value }}
              </dd>
            </div>
            <div class="flex flex-col bg-white/5 p-8">
              <dt class="mt-1 text-sm/6 font-semibold text-gray-300">
                Platforms
              </dt>
              <dd
                class="inline-flex items-center justify-center gap-x-4 order-first text-3xl font-semibold tracking-tight text-white"
              >
                <component
                  :is="item"
                  v-for="item in game.cloudSaveConfiguration.ludusaviEntry.entries
                    .map((e) => e.platform as PlatformClient)
                    .map((e) => PLATFORM_ICONS[e])"
                  :key="item.__name"
                  class="size-8 text-zinc-100"
                />
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
    <div
      class="lg:overflow-y-auto lg:border-l lg:border-zinc-800 lg:block lg:inset-y-0 lg:z-50 lg:w-[30vw] flex flex-col gap-y-8 px-6 py-4"
    ></div>
  </div>
</template>

<script setup lang="ts">
import type {
  CloudSaveConfiguration,
  Game,
  GameVersion,
  LudusaviEntry,
  LudusaviPlatformEntry,
} from "~/prisma/client";
import { Bars3Icon, TrashIcon } from "@heroicons/vue/24/solid";
import type { SerializeObject } from "nitropack";
import type { H3Error } from "h3";
import { CloudIcon, ServerStackIcon } from "@heroicons/vue/24/outline";

definePageMeta({
  layout: "admin",
});

// TODO implement UI for this page

defineProps<{ unimportedVersions: string[] }>();

const { t } = useI18n();

type FullGame = Game & { versions: GameVersion[] } & {
  cloudSaveConfiguration?: CloudSaveConfiguration & {
    ludusaviEntry?: LudusaviEntry & { entries: Array<LudusaviPlatformEntry> } | null;
  };
};
const game = defineModel() as Ref<SerializeObject<FullGame>>;
if (!game.value)
  throw createError({
    statusCode: 500,
    statusMessage: "Game not provided to editor component",
  });

async function updateLudusaviEntry(name: string) {
  try {
    const newConfig = await $dropFetch("/api/v1/admin/game/cloudsaves", {
      method: "PATCH",
      body: { id: game.value.id, name: name },
    });
    console.log(newConfig);
    game.value.cloudSaveConfiguration = newConfig;
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: t("errors.game.ludusavi.title"),
        description: t("errors.game.ludusavi.description", [
          // @ts-expect-error attempt to display statusMessage on error
          e?.statusMessage ?? t("errors.unknown"),
        ]),
      },
      (_, c) => c(),
    );
  }
}

async function updateVersionOrder() {
  try {
    const newVersions = await $dropFetch("/api/v1/admin/game/version", {
      method: "PATCH",
      body: {
        id: game.value.id,
        versions: game.value.versions.map((e) => e.versionName),
      },
    });
    game.value.versions = newVersions;
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: t("errors.version.order.title"),
        description: t("errors.version.order.desc", {
          error: (e as H3Error)?.statusMessage ?? t("errors.unknown"),
        }),
        buttonText: t("close"),
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
        id: game.value.id,
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
        title: t("errors.version.delete.title"),
        description: t("errors.version.delete.desc", {
          error: (e as H3Error)?.statusMessage ?? t("errors.unknown"),
        }),
        buttonText: t("close"),
      },
      (e, c) => c(),
    );
  }
}
</script>
