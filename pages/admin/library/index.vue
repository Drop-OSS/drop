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
          class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-500 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
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
    <div class="flex flex-row justify-between gap-x-5">
      <div v-if="toImport" class="rounded-md bg-zinc-600/10 p-3">
        <div class="flex">
          <div class="flex-shrink-0">
            <WrenchScrewdriverIcon
              class="h-5 w-5 text-zinc-400"
              aria-hidden="true"
            />
          </div>
          <div class="ml-3 flex-1 md:flex md:justify-between">
            <p class="text-sm text-zinc-400">
              {{ $t("library.admin.massImportTool") }}
            </p>
            <p class="mt-3 text-sm md:ml-6 md:mt-0">
              <NuxtLink
                href="/admin/library/mass-import"
                class="whitespace-nowrap font-medium text-zinc-400 hover:text-zinc-500"
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

      <div v-if="toImport" class="rounded-md bg-blue-600/10 p-3">
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
    </div>
    <!-- Search & filter -->
    <Disclosure
      as="section"
      aria-labelledby="filter-heading"
      class="mt-2 relative flex items-center border-y border-zinc-800 gap-x-4"
    >
      <h2 id="filter-heading" class="sr-only">
        {{ $t("library.admin.nav.filterLabel") }}
      </h2>
      <div class="relative col-start-1 row-start-1 py-4">
        <div class="mx-auto flex max-w-7xl divide-x divide-zinc-700 text-sm">
          <div class="pr-6">
            <DisclosureButton
              class="group flex items-center font-medium text-zinc-400"
            >
              <FunnelIcon
                class="mr-2 size-5 flex-none text-gray-400 group-hover:text-gray-500"
                aria-hidden="true"
              />
              {{
                $t("library.admin.nav.filterCount", [
                  Object.values(currentFilters).filter((v) => v).length,
                ])
              }}
            </DisclosureButton>
          </div>
          <div class="pl-6">
            <button type="button" class="text-zinc-400">
              {{ $t("library.admin.nav.clearAllFilters") }}
            </button>
          </div>
        </div>
      </div>
      <DisclosurePanel
        class="absolute bottom-0 translate-y-full left-0 border border-zinc-800 py-4 bg-zinc-900 rounded-b-xl z-10 shadow"
      >
        <div
          class="flex flex-wrap flex-col lg:flex-row max-w-7xl text-sm px-4 gap-4"
        >
          <fieldset v-for="filter in filterScaffold" :key="filter.value">
            <legend class="block font-medium text-zinc-100">
              {{ filter.title }}
            </legend>
            <div class="space-y-6 sm:space-y-4 pt-2">
              <div
                v-for="option in filter.values"
                :key="option.value"
                class="flex gap-3"
              >
                <div class="flex h-5 shrink-0 items-center">
                  <div class="group grid size-4 grid-cols-1">
                    <input
                      :id="createFilterKey(filter, option)"
                      v-model="currentFilters[createFilterKey(filter, option)]"
                      :value="createFilterKey(filter, option)"
                      type="checkbox"
                      class="col-start-1 row-start-1 appearance-none rounded-sm border border-zinc-700 bg-zinc-950 checked:border-blue-600 checked:bg-blue-600 indeterminate:border-blue-600 indeterminate:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-100 forced-colors:appearance-auto"
                    />
                    <svg
                      class="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-gray-950/25"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <path
                        class="opacity-0 group-has-checked:opacity-100"
                        d="M3 8L6 11L11 3.5"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <path
                        class="opacity-0 group-has-indeterminate:opacity-100"
                        d="M3 7H11"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </div>
                </div>
                <label
                  :for="createFilterKey(filter, option)"
                  class="text-base text-zinc-300 sm:text-sm"
                  >{{ option.label }}</label
                >
              </div>
            </div>
          </fieldset>
        </div>
      </DisclosurePanel>
      <div class="grow grid grid-cols-1">
        <input
          id="search"
          v-model="searchQuery"
          type="text"
          name="search"
          class="col-start-1 row-start-1 block w-full rounded-md bg-zinc-900 py-1.5 pl-10 pr-3 text-base text-zinc-100 border-[0px] outline-[0px] placeholder:text-zinc-400 sm:pl-9 sm:text-sm/6"
          :placeholder="$t('library.search')"
        />
        <MagnifyingGlassIcon
          class="pointer-events-none col-start-1 row-start-1 ml-3 size-5 self-center text-zinc-400 sm:size-4"
          aria-hidden="true"
        />
      </div>
      <div class="col-start-1 row-start-1 py-4">
        <div class="mx-auto flex max-w-7xl justify-end px-2">
          <Menu as="div" class="relative inline-block text-left">
            <div>
              <MenuButton
                class="group inline-flex justify-center text-sm font-medium text-zinc-400 hover:text-zinc-100"
              >
                {{ $t("store.view.sort") }}
                <ChevronDownIcon
                  class="-mr-1 ml-1 size-5 shrink-0 text-gray-400 group-hover:text-zinc-100"
                  aria-hidden="true"
                />
              </MenuButton>
            </div>

            <transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="transform opacity-0 scale-95"
            >
              <MenuItems
                class="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-md bg-zinc-950 shadow-2xl ring-1 ring-white/5 focus:outline-hidden"
              >
                <div class="py-1">
                  <MenuItem
                    v-for="option in sorts"
                    :key="option.param"
                    v-slot="{ active }"
                  >
                    <button
                      :class="[
                        currentSort == option.param
                          ? 'font-medium text-zinc-100'
                          : 'text-zinc-400',
                        active ? 'bg-zinc-900 outline-hidden' : '',
                        'w-full text-left block px-4 py-2 text-sm',
                      ]"
                      @click.prevent="handleSortClick(option, $event)"
                    >
                      {{ option.name }}
                      <span v-if="currentSort === option.param">
                        {{
                          sortOrder === "asc"
                            ? $t("chars.arrowUp")
                            : $t("chars.arrowDown")
                        }}
                      </span>
                    </button>
                  </MenuItem>
                </div>
              </MenuItems>
            </transition>
          </Menu>
        </div>
      </div>
    </Disclosure>
    <ul
      role="list"
      class="relative grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
    >
      <li
        v-for="game in libraryGames"
        :key="game.id"
        class="relative overflow-hidden col-span-1 flex flex-col justify-center divide-y divide-zinc-800 rounded-xl bg-zinc-950/30 text-left shadow-md border hover:scale-102 hover:shadow-xl hover:bg-zinc-950/70 border-zinc-800 transition-all duration-200 group"
      >
        <div class="flex flex-1 flex-row p-4 gap-x-4">
          <img
            class="h-20 w-20 p-3 flex-shrink-0 rounded-xl shadow group-hover:shadow-lg transition-all duration-200 bg-zinc-900 object-cover border border-zinc-800"
            :src="useObject(game.mIconObjectId)"
            alt=""
          />
          <div class="flex flex-col">
            <h3
              class="gap-2 text-sm flex flex-wrap items-center font-medium text-zinc-100 font-display"
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
                <svg
                  v-if="gameFeatureLoading[game.id]"
                  aria-hidden="true"
                  :class="[
                    game.featured ? ' fill-zinc-900' : 'fill-zinc-100',
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
                >{{ game.library!.name }}</span
              >
              <span
                class="inline-flex items-center rounded-full bg-green-600/10 px-2 py-1 text-xs font-medium text-green-600 ring-1 ring-inset ring-green-600/20"
                >{{ game.type }}</span
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
                {{ $t("common.delete") }}
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
          <div
            v-if="game.notifications.offline"
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
        v-if="libraryGames.length == 0 && hasLibraries"
        class="text-zinc-600 text-sm font-display font-bold uppercase text-center col-span-4"
      >
        {{ $t("common.noResults") }}
      </p>
      <p
        v-else-if="!hasLibraries"
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

      <div
        v-if="gamesLoading"
        class="absolute inset-0 bg-zinc-900/50 flex items-start p-4 justify-center"
      >
        <div role="status">
          <svg
            aria-hidden="true"
            class="size-8 text-transparent animate-spin fill-white"
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
          <span class="sr-only">{{ $t("common.srLoading") }}</span>
        </div>
      </div>
    </ul>
    <nav
      class="flex items-center justify-between border-t border-white/10 px-4 sm:px-0"
    >
      <div class="-mt-px flex w-0 flex-1">
        <button
          class="group inline-flex items-center border-t-2 border-transparent pt-4 pr-1 text-sm font-medium text-zinc-400 disabled:text-zinc-700 hover:not-disabled:border-white/20 hover:not-disabled:text-zinc-200"
          :disabled="currentIndex == 0"
          @click="previousPage"
        >
          <ArrowLongLeftIcon
            class="mr-3 size-5 text-zinc-500 group-disabled:text-zinc-700"
            aria-hidden="true"
          />
          {{ $t("library.admin.nav.backPagination") }}
        </button>
      </div>
      <div class="hidden md:-mt-px md:flex">
        <button
          v-for="page in maxPages"
          :key="page"
          :class="[
            currentIndex == page - 1
              ? 'border-blue-400 text-blue-400'
              : 'border-transparent hover:not-disabled:text-zinc-white/20 text-zinc-400 hover:not-disabled:border-white/20',
            'transition inline-flex items-center border-t-2 px-4 pt-4 text-sm font-medium',
          ]"
          @click="currentIndex = page - 1"
        >
          {{ page }}
        </button>
      </div>
      <div class="-mt-px flex w-0 flex-1 justify-end">
        <button
          class="group inline-flex items-center border-t-2 border-transparent pt-4 pl-1 text-sm font-medium text-zinc-400 disabled:text-zinc-700 hover:not-disabled:border-white/20 hover:not-disabled:text-zinc-200"
          :disabled="currentIndex == maxPages - 1"
          @click="nextPage"
        >
          {{ $t("library.admin.nav.nextPagination") }}
          <ArrowLongRightIcon
            class="ml-3 size-5 text-zinc-500 group-disabled:text-zinc-700"
            aria-hidden="true"
          />
        </button>
      </div>
    </nav>
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
  WrenchScrewdriverIcon,
  ArrowLongLeftIcon,
  ArrowLongRightIcon,
  ChevronDownIcon,
  FunnelIcon,
} from "@heroicons/vue/20/solid";
import { MagnifyingGlassIcon } from "@heroicons/vue/24/outline";
import type { AdminLibraryGame } from "~/server/api/v1/admin/library/index.get";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/vue";

const { t } = useI18n();

definePageMeta({
  layout: "admin",
});

useHead({
  title: t("library.admin.title"),
});

const { unimportedGames, hasLibraries } = await $dropFetch(
  "/api/v1/admin/library/libraries",
);

const route = useRoute();
const router = useRouter();

// Hard limit on server
const pageSize = 24;
const currentIndex = ref(
  route.query.page ? parseInt(route.query.page.toString()) - 1 : 0,
);
const maxIndex = ref(0);
const maxPages = computed(() => Math.ceil(maxIndex.value / pageSize));

const games = ref<AdminLibraryGame[]>([]);
const gamesLoading = ref(false);

const searchQuery = ref("");

function nextPage() {
  if (currentIndex.value < maxPages.value - 1) {
    currentIndex.value++;
  }
}

function previousPage() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
  }
}

const toImport = ref(Object.values(unimportedGames).flat().length > 0);

const libraryGames = computed(() =>
  games.value.map((e) => {
    if (e.status == "offline") {
      return {
        ...e.game,
        status: "offline",
        hasNotifications: true,
        notifications: {
          offline: true,
        },
      };
    }

    const noVersions = e.status.noVersions;
    const toImport = e.status.unimportedVersions.length > 0;

    return {
      ...e.game,
      notifications: {
        noVersions,
        toImport,
      },
      hasNotifications: noVersions || toImport,
      status: "online" as const,
    };
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

const currentFilters = ref<{ [key: string]: boolean }>({});

function createFilterKey(
  filter: { value: string },
  subfilter: { value: string },
) {
  return `${filter.value}.${subfilter.value}`;
}

const filters = computed(
  () =>
    ({
      version: [
        {
          value: "none",
          label: t("library.admin.nav.filters.version.none"),
        },
        /*{
          value: "available",
          label: t("library.admin.nav.filters.version.available"),
        },*/
      ],
      metadata: [
        {
          value: "featured",
          label: t("library.admin.nav.filters.metadata.featured"),
        },
        {
          value: "noCarousel",
          label: t("library.admin.nav.filters.metadata.noCarousel"),
        },
        {
          value: "emptyDescription",
          label: t("library.admin.nav.filters.metadata.emptyDescription"),
        },
      ],
    }) as const,
);

const filterScaffold = computed(
  () =>
    ({
      version: {
        title: t("library.admin.nav.filters.version.title"),
        value: "version",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        values: filters.value.version as any,
      },
      metadata: {
        title: t("library.admin.nav.filters.metadata.title"),
        value: "metadata",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        values: filters.value.metadata as any,
      },
    }) satisfies {
      [key in keyof typeof filters.value]: {
        title: string;
        value: string;
        values: Array<{ value: string; label: string }>;
      };
    },
);

const sorts: Array<StoreSortOption> = [
  {
    name: "Default",
    param: "default",
  },
  {
    name: "Newest",
    param: "newest",
  },
  {
    name: "Recently Added",
    param: "recent",
  },
  {
    name: "Name",
    param: "name",
  },
];

const currentSort = ref(sorts[0].param);
const sortOrder = ref<"asc" | "desc">("desc");

function handleSortClick(option: StoreSortOption, event: MouseEvent) {
  event.stopPropagation();
  if (currentSort.value === option.param) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    currentSort.value = option.param;
    sortOrder.value = option.param === "name" ? "asc" : "desc";
  }
}

async function fetchPage() {
  gamesLoading.value = true;
  const { results, count } = await $dropFetch("/api/v1/admin/library", {
    query: {
      skip: currentIndex.value * pageSize,
      limit: pageSize,
      sort: currentSort.value,
      order: sortOrder.value,
      filters: Object.entries(currentFilters.value)
        .filter(([_, enabled]) => enabled)
        .map(([name, _]) => name)
        .join(","),
      query: searchQuery.value ? searchQuery.value : undefined,
    },
    failTitle: "Failed to fetch game library",
  });
  maxIndex.value = count;
  games.value = results;
  gamesLoading.value = false;
  router.push({
    path: route.path,
    query: {
      ...route.query,
      page: currentIndex.value + 1,
    },
  });
}

function watchHandler() {
  fetchPage();
  document.body.scrollTop = document.documentElement.scrollTop = 0;
}

watch([currentIndex, currentSort, sortOrder], watchHandler);

watch(currentFilters, watchHandler, { deep: true });

let searchTimeout: NodeJS.Timeout | undefined;
watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  gamesLoading.value = true;
  searchTimeout = setTimeout(() => {
    watchHandler();
  }, 80);
});

await fetchPage();
</script>
