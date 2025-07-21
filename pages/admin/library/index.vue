<template>
  <div class="space-y-4">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base font-semibold text-zinc-100">
          {{ $t("library.admin.gameLibrary") }}
        </h1>
        <p class="mt-2 text-sm text-zinc-400">
          {{ $t("library.admin.subheader") }}
        </p>
      </div>
      <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
        <NuxtLink
          to="/admin/library/sources"
          class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-500 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <i18n-t
            keypath="library.admin.sources.link"
            tag="span"
            scope="global"
          >
            <template #arrow>
              <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
            </template>
          </i18n-t>
        </NuxtLink>
      </div>
    </div>
    <div v-if="toImport" class="rounded-md bg-blue-600/10 p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <InformationCircleIcon
            class="h-5 w-5 text-blue-400"
            aria-hidden="true"
          />
        </div>
        <div class="ml-3 flex-1 md:flex md:justify-between">
          <p class="text-sm text-blue-400">
            {{ $t("library.admin.detectedGame") }}
          </p>
          <p class="mt-3 text-sm md:ml-6 md:mt-0">
            <NuxtLink
              href="/admin/library/import"
              class="whitespace-nowrap font-medium text-blue-400 hover:text-blue-500"
            >
              <i18n-t
                keypath="library.admin.import.link"
                tag="span"
                scope="global"
              >
                <template #arrow>
                  <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
                </template>
              </i18n-t>
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
    <div class="mt-2 grid grid-cols-1">
      <input
        id="search"
        v-model="searchQuery"
        type="text"
        name="search"
        class="col-start-1 row-start-1 block w-full rounded-md bg-zinc-900 py-1.5 pl-10 pr-3 text-base text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:pl-9 sm:text-sm/6"
        :placeholder="$t('library.search')"
      />
      <MagnifyingGlassIcon
        class="pointer-events-none col-start-1 row-start-1 ml-3 size-5 self-center text-zinc-400 sm:size-4"
        aria-hidden="true"
      />
    </div>
    <ul
      role="list"
      class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
    >
      <li
        v-for="game in filteredLibraryGames"
        :key="game.id"
        class="col-span-1 flex flex-col justify-center divide-y divide-zinc-800 rounded-xl bg-zinc-950/30 text-left shadow-md border border-zinc-800 transition-all duration-200 hover:scale-102 hover:shadow-xl hover:bg-zinc-950/70 group"
      >
        <div class="flex flex-1 flex-row p-4 gap-x-4">
          <img
            class="h-20 w-20 p-3 flex-shrink-0 rounded-xl shadow group-hover:shadow-lg transition-all duration-200 bg-zinc-900 object-cover border border-zinc-800"
            :src="useObject(game.mIconObjectId)"
            alt=""
          />
          <div class="flex flex-col">
            <h3
              class="gap-x-2 text-sm inline-flex items-center font-medium text-zinc-100 font-display"
            >
              {{ game.mName }}
              <button
                type="button"
                :class="[
                  'rounded-full p-1 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2',
                  game.featured
                    ? 'bg-yellow-400 hover:bg-yellow-300 focus-visible:outline-yellow-400 text-zinc-900'
                    : 'bg-zinc-800 hover:bg-zinc-700 focus-visible:outline-zinc-400 text-white',
                ]"
                @click="() => featureGame(game.id)"
              >
                <StarIcon class="size-3" aria-hidden="true" />
              </button>
              <span
                class="inline-flex items-center rounded-full bg-blue-600/10 px-2 py-1 text-xs font-medium text-blue-600 ring-1 ring-inset ring-blue-600/20"
                >{{ game.library!.name }}</span
              >
            </h3>
            <dl class="mt-1 flex flex-col justify-between">
              <dt class="sr-only">{{ $t("library.admin.shortDesc") }}</dt>
              <dd class="text-sm text-zinc-400">
                {{ game.mShortDescription }}
              </dd>
              <dt class="sr-only">
                {{ $t("library.admin.metadataProvider") }}
              </dt>
            </dl>
            <div class="mt-4 flex flex-col gap-y-1">
              <NuxtLink
                :href="`/admin/library/${game.id}`"
                class="w-fit rounded-md bg-zinc-800 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <i18n-t
                  keypath="library.admin.openEditor"
                  tag="span"
                  scope="global"
                >
                  <template #arrow>
                    <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
                  </template>
                </i18n-t>
              </NuxtLink>
              <button
                class="w-fit rounded-md bg-red-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-red-500 hover:scale-105 hover:shadow-lg hover:shadow-red-500/25 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                @click="() => deleteGame(game.id)"
              >
                {{ $t("delete") }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="game.hasNotifications" class="flex flex-col gap-y-2 p-2">
          <div
            v-if="game.notifications.toImport"
            class="rounded-md bg-blue-600/10 p-4"
          >
            <div class="flex">
              <div class="flex-shrink-0">
                <InformationCircleIcon
                  class="h-5 w-5 text-blue-400"
                  aria-hidden="true"
                />
              </div>
              <div class="ml-3 flex-1 md:flex md:justify-between">
                <p class="text-sm text-blue-400">
                  {{ $t("library.admin.detectedVersion") }}
                </p>
                <p class="mt-3 text-sm md:ml-6 md:mt-0">
                  <NuxtLink
                    :href="`/admin/library/${game.id}/import`"
                    class="whitespace-nowrap font-medium text-blue-400 hover:text-blue-500"
                  >
                    <i18n-t
                      keypath="library.admin.import.link"
                      tag="span"
                      scope="global"
                    >
                      <template #arrow>
                        <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
                      </template>
                    </i18n-t>
                  </NuxtLink>
                </p>
              </div>
            </div>
          </div>
          <div
            v-if="game.notifications.noVersions"
            class="rounded-md bg-yellow-600/10 p-4"
          >
            <div class="flex">
              <div class="flex-shrink-0">
                <ExclamationTriangleIcon
                  class="h-5 w-5 text-yellow-600"
                  aria-hidden="true"
                />
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-yellow-600">
                  {{ $t("library.admin.version.noVersions") }}
                </h3>
              </div>
            </div>
          </div>
        </div>
      </li>
      <p
        v-if="filteredLibraryGames.length == 0 && libraryGames.length != 0"
        class="text-zinc-600 text-sm font-display font-bold uppercase text-center col-span-4"
      >
        {{ $t("common.noResults") }}
      </p>
      <p
        v-if="filteredLibraryGames.length == 0 && libraryGames.length == 0"
        class="text-zinc-600 text-sm font-display font-bold uppercase text-center col-span-4"
      >
        {{ $t("library.admin.noGames") }}
      </p>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ExclamationTriangleIcon } from "@heroicons/vue/16/solid";
import { InformationCircleIcon, StarIcon } from "@heroicons/vue/20/solid";
import { MagnifyingGlassIcon } from "@heroicons/vue/24/outline";

const { t } = useI18n();

definePageMeta({
  layout: "admin",
});

useHead({
  title: t("library.admin.title"),
});

const searchQuery = ref("");

const libraryState = await $dropFetch("/api/v1/admin/library");

const toImport = ref(
  Object.values(libraryState.unimportedGames).flat().length > 0,
);

const libraryGames = ref(
  libraryState.games.map((e) => {
    const noVersions = e.status.noVersions;
    const toImport = e.status.unimportedVersions.length > 0;

    return {
      ...e.game,
      notifications: {
        noVersions,
        toImport,
      },
      hasNotifications: noVersions || toImport,
    };
  }),
);

const filteredLibraryGames = computed(() =>
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore excessively deep ts
  libraryGames.value.filter((e) => {
    if (!searchQuery.value) return true;
    const searchQueryLower = searchQuery.value.toLowerCase();
    if (e.mName.toLowerCase().includes(searchQueryLower)) return true;
    if (e.mShortDescription.toLowerCase().includes(searchQueryLower))
      return true;
    return false;
  }),
);

async function deleteGame(id: string) {
  await $dropFetch(`/api/v1/admin/game?id=${id}`, { method: "DELETE" });
  const index = libraryGames.value.findIndex((e) => e.id === id);
  libraryGames.value.splice(index, 1);
  toImport.value = true;
}

async function featureGame(id: string) {
  const gameIndex = libraryGames.value.findIndex((e) => e.id === id);
  const game = libraryGames.value[gameIndex];

  await $dropFetch("/api/v1/admin/game", {
    method: "PATCH",
    body: { id, featured: !game.featured },
  });

  libraryGames.value[gameIndex].featured = !game.featured;
}
</script>
