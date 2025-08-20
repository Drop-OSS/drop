<!-- eslint-disable vue/no-v-html -->
<template>
  <div v-if="game && unimportedVersions">
    <div class="grow flex flex-row gap-y-8">
      <div class="grow w-full h-full px-6 py-4 flex flex-col"></div>
      <div
        class="lg:overflow-y-auto lg:border-l lg:border-zinc-800 lg:block lg:inset-y-0 lg:z-50 lg:w-[30vw] flex flex-col gap-y-8 px-6 py-4"
      >
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
                  {{ $t("library.admin.versionPriority") }}

                  <!-- import games button -->

                  <NuxtLink
                    :href="canImport ? `/admin/library/${game.id}/import` : ''"
                    type="button"
                    :class="[
                      canImport
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-blue-800/50',
                      'inline-flex w-fit items-center gap-x-2 rounded-md  px-3 py-1 text-sm font-semibold font-display text-white shadow-sm  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
                    ]"
                  >
                    {{
                      canImport
                        ? $t("library.admin.import.version.import")
                        : $t("library.admin.import.version.noVersions")
                    }}
                  </NuxtLink>
                </h3>
              </div>
            </div>

            <div class="mt-4 text-center w-full text-sm text-zinc-600">
              {{ $t("lowest") }}
            </div>
            <draggable
              :list="game.versions"
              handle=".handle"
              class="mt-2 space-y-4"
              @update="() => updateVersionOrder()"
            >
              <template
                #item="{
                  element: item,
                }: {
                  element: VersionModel & { gameVersion: GameVersionModel };
                }"
              >
                <div
                  class="w-full inline-flex items-center px-4 py-2 bg-zinc-800 rounded justify-between"
                >
                  <div class="text-zinc-100 font-semibold">
                    {{ item.versionName }}
                  </div>
                  <div class="text-zinc-400">
                    {{
                      item.gameVersion.delta
                        ? $t("library.admin.version.delta")
                        : ""
                    }}
                  </div>
                  <div class="inline-flex items-center gap-x-2">
                    <component
                      :is="PLATFORM_ICONS[item.platform]"
                      class="size-6 text-blue-600"
                    />
                    <Bars3Icon
                      class="cursor-move w-6 h-6 text-zinc-400 handle"
                    />
                    <button @click="() => deleteVersion(item.versionId)">
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
    </div>
  </div>
  <div v-else class="grow w-full flex items-center justify-center">
    <div class="flex flex-col items-center">
      <ExclamationCircleIcon
        class="h-12 w-12 text-red-600"
        aria-hidden="true"
      />
      <div class="mt-3 text-center sm:mt-5">
        <h1 class="text-3xl font-semibold font-display leading-6 text-zinc-100">
          {{ $t("library.admin.offlineTitle") }}
        </h1>
        <div class="mt-4">
          <p class="text-sm text-zinc-400 max-w-md">
            {{ $t("library.admin.offline") }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  GameModel,
  GameVersionModel,
  VersionModel,
} from "~/prisma/client/models";
import { Bars3Icon, TrashIcon } from "@heroicons/vue/24/solid";
import type { SerializeObject } from "nitropack";
import type { H3Error } from "h3";
import { ExclamationCircleIcon } from "@heroicons/vue/24/outline";

// TODO implement UI for this page

const props = defineProps<{ unimportedVersions: string[] }>();

const { t } = useI18n();

const hasDeleted = ref(false);

const canImport = computed(
  () => hasDeleted.value || props.unimportedVersions.length > 0,
);

type GameAndVersions = GameModel & {
  versions: (VersionModel & { gameVersion: GameVersionModel })[];
};
const game = defineModel<SerializeObject<GameAndVersions>>() as Ref<
  SerializeObject<GameAndVersions>
>;
if (!game.value)
  throw createError({
    statusCode: 500,
    statusMessage: "Game not provided to editor component",
  });

async function updateVersionOrder() {
  try {
    const newVersions = await $dropFetch("/api/v1/admin/game/version", {
      method: "PATCH",
      body: {
        id: game.value.id,
        versions: game.value.versions.map((e) => e.versionId),
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
        buttonText: t("common.close"),
      },
      (e, c) => c(),
    );
  }
}

async function deleteVersion(versionId: string) {
  await $dropFetch("/api/v1/admin/game/version", {
    method: "DELETE",
    body: {
      id: versionId,
    },
    failTitle: "Failed to delete version.",
  });
  game.value.versions.splice(
    game.value.versions.findIndex((e) => e.versionId === versionId),
    1,
  );
  hasDeleted.value = true;
}
</script>
