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

    <div class="flex gap-x-4 text-zinc-300 font-bold uppercase font-display text-sm">
      <span class="inline-flex items-center gap-x-1"
        ><div class="size-2 rounded-full bg-blue-600" />
        Game</span
      >
      <span class="inline-flex items-center gap-x-1"
        ><div class="size-2 rounded-full bg-emerald-600" />
        Redistributable</span
      >
    </div>
    <ul
      role="list"
      class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
    >
      <li
        v-for="entry in filteredLibrary"
        :key="entry.id"
        class="relative overflow-hidden col-span-1 flex flex-col justify-center divide-y divide-zinc-800 rounded-xl bg-zinc-950/30 text-left shadow-md border hover:scale-102 hover:shadow-xl hover:bg-zinc-950/70 border-zinc-800 transition-all duration-200 group"
      >
        <div
          v-if="entry.type === 'game'"
          class="relative flex flex-1 flex-row p-4 gap-x-4"
        >
          <div
            class="absolute top-0 right-0 w-10 bg-blue-600 h-4 rotate-[45deg] translate-x-1/2"
          />

          <img
            class="h-20 w-20 p-3 flex-shrink-0 rounded-xl shadow group-hover:shadow-lg transition-all duration-200 bg-zinc-900 object-cover border border-zinc-800"
            :src="useObject(entry.mIconObjectId)"
            alt=""
          />
          <div class="flex flex-col">
            <h3
              class="gap-x-2 text-sm inline-flex items-center font-medium text-zinc-100 font-display"
            >
              {{ entry.mName }}
              <button
                type="button"
                :class="[
                  'rounded-full p-1 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2',
                  entry.featured
                    ? 'bg-yellow-400 hover:bg-yellow-300 focus-visible:outline-yellow-400 text-zinc-900'
                    : 'bg-zinc-800 hover:bg-zinc-700 focus-visible:outline-zinc-400 text-white',
                ]"
                @click="() => featureGame(entry.id)"
              >
                <svg
                  v-if="gameFeatureLoading[entry.id]"
                  aria-hidden="true"
                  :class="[
                    entry.featured ? ' fill-zinc-900' : 'fill-zinc-100',
                    'size-3 text-transparent animate-spin',
                  ]"
                  viewBox="0 0 100 101"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                    fill="currentColor"
                  />
                  <path
                    d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                    fill="currentFill"
                  />
                </svg>

                <StarIcon v-else class="size-3" aria-hidden="true" />
              </button>
              <span
                class="inline-flex items-center rounded-full bg-blue-600/10 px-2 py-1 text-xs font-medium text-blue-600 ring-1 ring-inset ring-blue-600/20"
                >{{ entry.library.name }}</span
              >
            </h3>
            <dl class="mt-1 flex flex-col justify-between">
              <dt class="sr-only">{{ $t("library.admin.shortDesc") }}</dt>
              <dd class="text-sm text-zinc-400">
                {{ entry.mShortDescription }}
              </dd>
              <dt class="sr-only">
                {{ $t("library.admin.metadataProvider") }}
              </dt>
            </dl>
            <div class="mt-4 flex flex-col gap-y-1">
              <NuxtLink
                :href="`/admin/library/g/${entry.id}`"
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
                @click="() => deleteGame(entry.id)"
              >
                {{ $t("delete") }}
              </button>
            </div>
          </div>
        </div>
        <div
          v-else-if="entry.type === 'redist'"
          class="relative flex flex-1 flex-row p-4 gap-x-4"
        >
          <div
            class="absolute top-0 right-0 w-10 bg-emerald-600 h-4 rotate-[45deg] translate-x-1/2"
          />
          <img
            class="h-20 w-20 p-3 flex-shrink-0 rounded-xl shadow group-hover:shadow-lg transition-all duration-200 bg-zinc-900 object-cover border border-zinc-800"
            :src="useObject(entry.mIconObjectId)"
            alt=""
          />
          <div class="flex flex-col">
            <h3
              class="gap-x-2 text-sm inline-flex items-center font-medium text-zinc-100 font-display"
            >
              {{ entry.mName }}
              <span
                class="inline-flex items-center rounded-full bg-blue-600/10 px-2 py-1 text-xs font-medium text-blue-600 ring-1 ring-inset ring-blue-600/20"
                >{{ entry.library.name }}</span
              >
            </h3>
            <dl class="mt-1 flex flex-col justify-between">
              <dt class="sr-only">{{ $t("library.admin.shortDesc") }}</dt>
              <dd class="text-sm text-zinc-400">
                {{ entry.mShortDescription }}
              </dd>
            </dl>
            <dl
              v-if="entry.platform"
              class="mt-2 flex items-center text-zinc-200 font-semibold text-sm gap-x-1 p-2 bg-zinc-800 rounded-xl"
            >
              <IconsPlatform
                :platform="entry.platform.id"
                :fallback="entry.platform.iconSvg"
                class="size-6 text-blue-600"
              />
              <span>{{ entry.platform.platformName }}</span>
            </dl>
            <div class="mt-4 flex flex-col gap-y-1">
              <NuxtLink
                :href="`/admin/library/r/${entry.id}`"
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
                @click="() => deleteRedist(entry.id)"
              >
                {{ $t("delete") }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="entry.hasNotifications" class="flex flex-col gap-y-2 p-2">
          <div
            v-if="entry.notifications.toImport"
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
                    :href="`/admin/library/g/${entry.id}/import`"
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
            v-if="entry.notifications.noVersions"
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
          <div
            v-if="entry.notifications.offline"
            class="rounded-md bg-red-600/10 p-4"
          >
            <div class="flex">
              <div class="flex-shrink-0">
                <ExclamationCircleIcon
                  class="h-5 w-5 text-red-600"
                  aria-hidden="true"
                />
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-600">
                  {{ $t("library.admin.offline") }}
                </h3>
              </div>
            </div>
          </div>
        </div>
      </li>
      <p
        v-if="filteredLibrary.length == 0 && libraryGames.length != 0"
        class="text-zinc-600 text-sm font-display font-bold uppercase text-center col-span-4"
      >
        {{ $t("common.noResults") }}
      </p>
      <p
        v-if="
          filteredLibrary.length == 0 &&
          libraryGames.length == 0 &&
          libraryState.hasLibraries
        "
        class="text-zinc-600 text-sm font-display font-bold uppercase text-center col-span-4"
      >
        {{ $t("library.admin.noGames") }}
      </p>
      <p
        v-else-if="!libraryState.hasLibraries"
        class="flex flex-col gap-2 text-zinc-600 text-center col-span-4"
      >
        <span class="text-sm font-display font-bold uppercase">{{
          $t("library.admin.libraryHint")
        }}</span>

        <NuxtLink
          class="transition text-xs text-zinc-600 hover:underline hover:text-zinc-400"
          href="https://docs.droposs.org/docs/library"
          target="_blank"
        >
          <i18n-t
            keypath="library.admin.libraryHintDocsLink"
            tag="span"
            scope="global"
            class="inline-flex items-center gap-x-1"
          >
            <template #arrow>
              <ArrowTopRightOnSquareIcon class="size-4" />
            </template>
          </i18n-t>
        </NuxtLink>
      </p>
    </ul>
  </div>
</template>

<script setup lang="ts">
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
} from "@heroicons/vue/16/solid";
import {
  ArrowTopRightOnSquareIcon,
  InformationCircleIcon,
  StarIcon,
} from "@heroicons/vue/20/solid";
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

// Potentially make a server-side transformation to make the client lighter
function clientSideTransformation<T, V extends keyof T, K extends string>(
  values: Array<T & { status: (typeof libraryState.games)[number]["status"] }>,
  expand: V,
  type: K,
): Array<
  T[V] & {
    status: "online" | "offline";
    type: K;
    hasNotifications?: boolean;
    notifications: {
      noVersions?: boolean;
      toImport?: boolean;
      offline?: boolean;
    };
  }
> {
  return values.map((e) => {
    if (e.status == "offline") {
      return {
        ...e[expand],
        type: type,
        status: "offline" as const,
        hasNotifications: true,
        notifications: {
          offline: true,
        },
      };
    }

    const noVersions = e.status.noVersions;
    const toImport = e.status.unimportedVersions.length > 0;

    return {
      ...e[expand],
      type: type,
      notifications: {
        noVersions,
        toImport,
      },
      hasNotifications: noVersions || toImport,
      status: "online" as const,
    };
  });
}

const libraryGames = ref(
  clientSideTransformation(libraryState.games, "value", "game"),
);
const libraryRedists = ref(
  clientSideTransformation(libraryState.redists, "value", "redist"),
);

const filteredLibrary = computed(() =>
  [...libraryGames.value, ...libraryRedists.value].filter((e) => {
    if (!searchQuery.value) return true;
    const searchQueryLower = searchQuery.value.toLowerCase();
    if (e.mName.toLowerCase().includes(searchQueryLower)) return true;
    if (e.mShortDescription.toLowerCase().includes(searchQueryLower))
      return true;
    return false;
  }),
);

async function deleteGame(id: string) {
  await $dropFetch(`/api/v1/admin/game/${id}`, {
    method: "DELETE",
    failTitle: "Failed to delete game",
  });
  const index = libraryGames.value.findIndex((e) => e.id === id);
  libraryGames.value.splice(index, 1);
  toImport.value = true;
}

async function deleteRedist(id: string) {
  await $dropFetch(`/api/v1/admin/redist/${id}`, {
    method: "DELETE",
    failTitle: "Failed to delete game",
  });
  const index = libraryRedists.value.findIndex((e) => e.id === id);
  libraryRedists.value.splice(index, 1);
  toImport.value = true;
}

const gameFeatureLoading = ref<{ [key: string]: boolean }>({});
async function featureGame(id: string) {
  const gameIndex = libraryGames.value.findIndex((e) => e.id === id);
  const game = libraryGames.value[gameIndex];
  gameFeatureLoading.value[game.id] = true;

  await $dropFetch(`/api/v1/admin/game/:id`, {
    method: "PATCH",
    params: {
      id: game.id,
    },
    body: { featured: !game.featured },
    failTitle: "Failed to feature/unfeature game",
  });

  libraryGames.value[gameIndex].featured = !game.featured;
  gameFeatureLoading.value[game.id] = false;
}
</script>
