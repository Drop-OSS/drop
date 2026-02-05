<!-- eslint-disable vue/no-v-html -->
<template>
  <div v-if="game && unimportedVersions" class="px-4 sm:px-6 lg:px-8 py-8">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base font-semibold text-white">
          {{ $t("library.admin.version.title") }}
        </h1>
        <p class="mt-2 text-sm text-gray-300">
          {{ $t("library.admin.version.description") }}
        </p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
        <NuxtLink
          :href="canImport ? `/admin/library/${game.id}/import` : ''"
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
    <div class="mt-8 flow-root">
      <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <table class="relative min-w-full divide-y divide-white/15">
            <thead>
              <tr>
                <th></th>
                <th
                  scope="col"
                  class="py-3 pr-3 pl-4 text-left text-xs font-medium tracking-wide text-gray-400 uppercase sm:pl-0"
                >
                  {{ $t("library.admin.version.table.name") }}
                </th>
                <th
                  scope="col"
                  class="px-3 py-3 text-left text-xs font-medium tracking-wide text-gray-400 uppercase"
                >
                  {{ $t("library.admin.version.table.path") }}
                </th>
                <th
                  scope="col"
                  class="px-3 py-3 text-left text-xs font-medium tracking-wide text-gray-400 uppercase"
                >
                  {{ $t("library.admin.version.table.setup") }}
                </th>
                <th
                  scope="col"
                  class="px-3 py-3 text-left text-xs font-medium tracking-wide text-gray-400 uppercase"
                >
                  {{ $t("library.admin.version.table.launch") }}
                </th>
                <th scope="col" class="py-3 pr-4 pl-3 sm:pr-0">
                  <span class="sr-only">{{ $t("common.edit") }}</span>
                </th>
              </tr>
            </thead>
            <draggable
              :list="game.versions"
              handle=".handle"
              class="divide-y divide-white/10"
              tag="tbody"
              @update="() => updateVersionOrder()"
            >
              <template #item="{ element: version }: { element: VersionType }">
                <tr :key="version.versionId">
                  <td>
                    <Bars3Icon
                      class="cursor-move w-6 h-6 text-zinc-400 handle"
                    />
                  </td>
                  <td class="py-4 pr-3 pl-4 sm:pl-0">
                    <div class="flex flex-col">
                      <span
                        class="text-sm font-medium whitespace-nowrap text-white"
                        >{{ version.displayName ?? version.versionPath }}</span
                      >
                      <span class="text-xs text-zinc-500 mono">{{
                        version.versionId
                      }}</span>
                    </div>
                  </td>
                  <td class="px-3 py-4 text-sm whitespace-nowrap text-gray-400">
                    {{ version.versionPath }}
                  </td>
                  <td class="px-3 py-4 text-sm whitespace-nowrap text-gray-400">
                    <ul class="space-y-2">
                      <GameEditorVersionConfig
                        v-for="config in version.setups"
                        :key="config.setupId"
                        :config="config"
                      />
                      <li
                        v-if="version.setups.length == 0"
                        class="text-xs uppercase font-display text-zinc-700 font-semibold"
                      >
                        {{ $t("library.admin.version.noSetups") }}
                      </li>
                    </ul>
                  </td>
                  <td class="px-3 py-4 text-sm whitespace-nowrap text-gray-400">
                    <div v-if="version.onlySetup">
                      {{ $t("library.admin.version.setupOnly") }}
                    </div>
                    <ul v-else class="space-y-2">
                      <GameEditorVersionConfig
                        v-for="config in version.launches"
                        :key="config.launchId"
                        :config="config"
                      />
                    </ul>
                  </td>
                  <td
                    class="py-4 pr-4 pl-3 text-right text-sm font-medium whitespace-nowrap sm:pr-0 space-x-2"
                  >
                    <!--
                    <button class="text-blue-400 hover:text-blue-300">
                      Edit<span class="sr-only"
                        >,
                        {{ version.displayName ?? version.versionPath }}</span
                      >
                    </button>
                    -->
                    <button
                      class="text-red-400 hover:text-red-300"
                      @click="() => deleteVersion(version.versionId)"
                    >
                      {{ $t("common.delete") }}
                    </button>
                  </td>
                </tr></template
              >
            </draggable>
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
import type { SerializeObject } from "nitropack";
import type { H3Error } from "h3";
import { ExclamationCircleIcon, Bars3Icon } from "@heroicons/vue/24/outline";
import type { AdminFetchGameType } from "~/server/api/v1/admin/game/[id]/index.get";

// TODO implement UI for this page

const props = defineProps<{ unimportedVersions: string[] }>();

const { t } = useI18n();

const hasDeleted = ref(false);

const canImport = computed(
  () => hasDeleted.value || props.unimportedVersions.length > 0,
);

const game = defineModel<SerializeObject<AdminFetchGameType>>({
  required: true,
});
if (!game.value)
  throw createError({
    statusCode: 500,
    statusMessage: "Game not provided to editor component",
  });

type VersionType = (typeof game.value.versions)[number];

async function updateVersionOrder() {
  try {
    const newVersionOrder = await $dropFetch(
      "/api/v1/admin/game/:id/versions",
      {
        method: "PATCH",
        body: {
          versions: game.value.versions.map((e) => e.versionId),
        },
        params: {
          id: game.value.id,
        },
      },
    );
    const newVersions = newVersionOrder.map(
      (id) => game.value.versions.find((k) => k.versionId == id)!,
    );
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
  try {
    await $dropFetch("/api/v1/admin/game/:id/versions", {
      method: "DELETE",
      body: {
        version: versionId,
      },
      params: {
        id: game.value.id,
      },
    });
    game.value.versions.splice(
      game.value.versions.findIndex((e) => e.versionId === versionId),
      1,
    );
    hasDeleted.value = true;
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: t("errors.version.delete.title"),
        description: t("errors.version.delete.desc", {
          error: (e as H3Error)?.statusMessage ?? t("errors.unknown"),
        }),
        buttonText: t("common.close"),
      },
      (e, c) => c(),
    );
  }
}
</script>
