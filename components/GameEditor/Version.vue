<!-- eslint-disable vue/no-v-html -->
<template>
  <div v-if="game && unimportedVersions" class="p-8">
    <div>
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base font-semibold text-zinc-100">Versions</h1>
          <p class="mt-2 text-sm text-zinc-400 max-w-lg">
            Versions are a collection of files that are downloaded to clients.
            Each version can have multiple configurations, for different
            platforms.
          </p>
        </div>
        <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <NuxtLink
            :href="canImport ? `/admin/library/g/${game.id}/import` : ''"
            type="button"
            :class="[
              canImport ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-800/50',
              'inline-flex w-fit items-center gap-x-2 rounded-md  px-3 py-1 text-sm font-semibold font-display text-white shadow-sm  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
            ]"
          >
            {{
              canImport
                ? $t("library.admin.import.version.import")
                : $t("library.admin.import.version.noVersions")
            }}
          </NuxtLink>
        </div>
      </div>
      <div class="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm">
        <div>
          <table class="min-w-full divide-y divide-zinc-800">
            <thead>
              <tr class="bg-zinc-800/50">
                <th
                  scope="col"
                  class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-zinc-100 sm:pl-6"
                >
                  Version Name
                </th>
                <th
                  scope="col"
                  class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                >
                  Imported
                </th>
                <th
                  scope="col"
                  class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                >
                  Platforms
                </th>
                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span class="sr-only">{{ $t("actions") }}</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-800">
              <tr
                v-for="version in game.versions"
                :key="version.versionId"
                class="transition-colors duration-150 hover:bg-zinc-800/50"
              >
                <td
                  class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-100 sm:pl-6"
                >
                  {{ version.versionName }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                  <RelativeTime :date="version.created" />
                </td>
                <td class="px-3 py-4">
                  <ul class="space-y-4">
                    <li
                      v-for="gameVersion in version.gameVersions"
                      :key="gameVersion.versionId"
                      class="px-3 py-2 border border-zinc-800 rounded-lg shadow"
                    >
                      <div>
                        <div
                          class="text-sm flex items-center gap-x-2 text-zinc-200 font-semibold"
                        >
                          <IconsPlatform
                            :platform="
                              platforms[gameVersion.platformId].platformIcon.key
                            "
                            :fallback="
                              platforms[gameVersion.platformId].platformIcon
                                .fallback
                            "
                            class="size-5 text-blue-500"
                          />
                          <span class="block truncate">{{
                            platforms[gameVersion.platformId].name
                          }}</span>
                        </div>

                        <!-- launch commands -->
                        <div class="space-y-1 mt-4">
                          <div
                            v-if="gameVersion.install"
                            class="flex items-center justify-between"
                          >
                            <span
                              class="font-display text-xs text-zinc-300 font-semibold uppercase tracking-wide"
                              >Install</span
                            >

                            <div
                              class="whitespace-nowrap font-mono text-xs text-zinc-300 bg-zinc-950 px-1 py-0.5 w-fit rounded"
                            >
                              <span class="text-zinc-700">(install dir)/</span
                              >{{ gameVersion.install.command }}
                              {{ gameVersion.install.args }}
                            </div>
                          </div>

                          <div>
                            <span class="font-semibold text-sm text-zinc-100"
                              >Launch options</span
                            >
                            <ul class="divide-y divide-zinc-700">
                              <li
                                v-for="launch in gameVersion.launches"
                                :key="launch.command"
                                class="ml-2 py-2 flex justify-between items-center"
                              >
                                <h1
                                  class="font-display text-xs text-zinc-300 font-semibold uppercase tracking-wide"
                                >
                                  {{ launch.name }}
                                </h1>
                                <div
                                  class="mt-1 whitespace-nowrap font-mono text-xs text-zinc-300 bg-zinc-950 px-1 py-0.5 w-fit rounded"
                                >
                                  <span class="text-zinc-700"
                                    >(install dir)/</span
                                  >{{ launch.command }} {{ launch.args }}
                                </div>
                              </li>
                            </ul>
                          </div>

                          <div
                            v-if="gameVersion.uninstall"
                            class="flex items-center justify-between"
                          >
                            <span
                              class="font-display text-xs text-zinc-300 font-semibold uppercase tracking-wide"
                              >Uninstall</span
                            >

                            <div
                              class="whitespace-nowrap font-mono text-xs text-zinc-300 bg-zinc-950 px-1 py-0.5 w-fit rounded"
                            >
                              <span class="text-zinc-700">(install dir)/</span
                              >{{ gameVersion.uninstall.command }}
                              {{ gameVersion.uninstall.args }}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  </ul>
                </td>
                <td
                  class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6"
                >
                  <button
                    class="inline-flex items-center rounded-md bg-red-400/10 px-2 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-400/20 transition-all duration-200 hover:bg-red-400/20 hover:scale-105 active:scale-95"
                    @click="() => deleteVersion(version.versionId)"
                  >
                    Delete
                    <span class="sr-only">
                      {{ $t("chars.srComma", [version.versionName]) }}
                    </span>
                  </button>
                </td>
              </tr>
              <tr v-if="game.versions.length === 0">
                <td colspan="5" class="py-8 text-center text-sm text-zinc-400">
                  No versions
                </td>
              </tr>
            </tbody>
          </table>
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
import type { SerializeObject, TypedInternalResponse } from "nitropack";
import type { H3Error } from "h3";
import { ExclamationCircleIcon } from "@heroicons/vue/24/outline";

// TODO implement UI for this page

const props = defineProps<{ unimportedVersions: string[] }>();

const { t } = useI18n();

const hasDeleted = ref(false);

const canImport = computed(
  () => hasDeleted.value || props.unimportedVersions.length > 0,
);

type GameFetchType = TypedInternalResponse<
  "/api/v1/admin/game/:id",
  unknown,
  "get"
>["game"];
const game = defineModel<SerializeObject<GameFetchType>>({ required: true });
if (!game.value)
  throw createError({
    statusCode: 500,
    message: "Game not provided to editor component",
  });

const rawPlatforms = await useAdminPlatforms();
const platforms = Object.fromEntries(
  renderPlatforms(rawPlatforms).map((v) => [v.param, v]),
);

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
          error: (e as H3Error)?.message ?? t("errors.unknown"),
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
