<template>
  <div class="space-y-4">
    <div
      class="relative overflow-hidden rounded-lg flex flex-col lg:flex-row lg:justify-between items-start lg:items-center gap-2 p-8"
    >
      <img
        :src="useObject(company.mBannerObjectId)"
        class="absolute inset-0 w-full h-full object-cover object-center"
      />
      <div class="absolute inset-0 bg-zinc-900/50" />

      <div class="relative inline-flex items-center gap-4">
        <!-- icon image -->
        <img :src="useObject(company.mLogoObjectId)" class="size-20 rounded" />
        <div>
          <h1 class="text-5xl font-bold font-display text-zinc-100">
            {{ company.mName }}
          </h1>
          <p class="mt-1 text-lg text-zinc-400">
            {{ company.mShortDescription }}
          </p>
          <p class="mt-1 text-zinc-600">
            {{ company.mWebsite }}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="relative inline-flex gap-x-3 items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        {{ $t("common.edit") }} <PencilIcon class="size-4" />
      </button>
    </div>
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base font-semibold text-zinc-100">
          {{ $t("library.admin.metadata.companies.editor.libraryTitle") }}
        </h1>
        <p class="mt-2 text-sm text-zinc-400">
          {{ $t("library.admin.metadata.companies.editor.libraryDescription") }}
        </p>
      </div>
      <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
        <button
          class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-500 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          @click="() => (addGameModelOpen = true)"
        >
          <i18n-t
            keypath="library.admin.metadata.companies.editor.action"
            tag="span"
            scope="global"
            class="inline-flex items-center gap-x-1"
          >
            <template #plus>
              <PlusIcon class="size-4" />
            </template>
          </i18n-t>
        </button>
      </div>
    </div>
    <div class="mt-2 grid grid-cols-1">
      <input
        id="search"
        v-model="searchQuery"
        type="text"
        name="search"
        class="col-start-1 row-start-1 block w-full rounded-md bg-zinc-900 py-1.5 pl-10 pr-3 text-base text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:pl-9 sm:text-sm/6"
        :placeholder="$t('library.admin.metadata.companies.searchGames')"
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
        v-for="game in filteredGames"
        :key="game.id"
        class="relative overflow-hidden col-span-1 flex flex-col justify-center divide-y divide-zinc-800 rounded-xl bg-zinc-950/30 text-left shadow-md border border-zinc-800 group"
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
            </h3>
            <dl class="mt-1 flex flex-col justify-between">
              <dt class="sr-only">{{ $t("library.admin.shortDesc") }}</dt>
              <dd class="text-sm text-zinc-400">
                {{ game.mShortDescription }}
              </dd>
            </dl>
            <div class="mt-4 flex flex-col gap-y-3">
              <div class="flex items-center gap-3">
                <div
                  class="group/published relative inline-flex w-7 shrink-0 rounded-full p-0.5 inset-ring outline-offset-2 transition-colors duration-200 ease-in-out has-focus-visible:outline-2 bg-white/5 inset-ring-white/10 outline-blue-500 has-checked:bg-blue-500"
                >
                  <span
                    class="size-3 rounded-full bg-white shadow-xs ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-has-checked/published:translate-x-3"
                  />
                  <input
                    id="published"
                    v-model="published[game.id]"
                    type="checkbox"
                    class="w-auto h-auto opacity-0 absolute inset-0 focus:outline-hidden"
                    aria-labelledby="published-label"
                  />
                </div>

                <label
                  id="published-label"
                  for="published"
                  class="font-medium text-xs text-zinc-100"
                  >{{
                    $t("library.admin.metadata.companies.editor.published")
                  }}</label
                >
              </div>
              <div class="flex items-center gap-3">
                <div
                  class="group/developed relative inline-flex w-7 shrink-0 rounded-full p-0.5 inset-ring outline-offset-2 transition-colors duration-200 ease-in-out has-focus-visible:outline-2 bg-white/5 inset-ring-white/10 outline-blue-500 has-checked:bg-blue-500"
                >
                  <span
                    class="size-3 rounded-full bg-white shadow-xs ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-has-checked/developed:translate-x-3"
                  />
                  <input
                    id="developed"
                    v-model="developed[game.id]"
                    type="checkbox"
                    class="w-auto h-auto opacity-0 absolute inset-0 focus:outline-hidden"
                    aria-labelledby="developed-label"
                  />
                </div>

                <label
                  id="developed-label"
                  for="published"
                  class="font-medium text-xs text-zinc-100"
                  >{{
                    $t("library.admin.metadata.companies.editor.developed")
                  }}</label
                >
              </div>
              <button
                class="w-fit rounded-md bg-red-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-red-500 hover:scale-105 hover:shadow-lg hover:shadow-red-500/25 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                @click="() => removeGame(game.id)"
              >
                {{ $t("common.remove") }}
              </button>
            </div>
          </div>
        </div>
      </li>
      <p
        v-if="filteredGames.length == 0 && games.length != 0"
        class="text-zinc-600 text-sm font-display font-bold uppercase text-center col-span-4"
      >
        {{ $t("common.noResults") }}
      </p>
      <p
        v-if="filteredGames.length == 0 && games.length == 0"
        class="text-zinc-600 text-sm font-display font-bold uppercase text-center col-span-4"
      >
        {{ $t("library.admin.metadata.companies.noGames") }}
      </p>
    </ul>
    <div class="text-zinc-100">
      {{ company }}
      {{ games.map((e) => e.id) }}
    </div>
    <ModalAddCompanyGame
      v-model="addGameModelOpen"
      :exclude="games.map((e) => e.id)"
      :company-id="company.id"
      @created="appendGame"
    />
  </div>
</template>

<script setup lang="ts">
import { MagnifyingGlassIcon } from "@heroicons/vue/24/outline";
import { PencilIcon, PlusIcon } from "@heroicons/vue/24/solid";
import type { SerializeObject } from "nitropack";
import type { GameModel } from "~/prisma/client/models";

definePageMeta({
  layout: "admin",
});

const route = useRoute();
const companyId = route.params.id!.toString();
const result = await $dropFetch("/api/v1/admin/company/:id", {
  params: { id: companyId },
});
const company = ref(result.company);
const games = ref(result.games);

const addGameModelOpen = ref(false);

useHead({
  title: `${company.value.mName} - Company`,
});

const searchQuery = ref("");

const filteredGames = computed(() =>
  games.value.filter(
    (e: SerializeObject<GameModel>) =>
      e.mName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      e.mShortDescription.includes(searchQuery.value.toLowerCase()),
  ),
);

function buildToggleProxy(param: "developed" | "published") {
  async function tick(id: string, enabled: boolean) {
    if (
      company.value.developed.length == 0 &&
      company.value.published.length == 0
    )
      return await removeGame(id);

    await $dropFetch("/api/v1/admin/company/:id/game", {
      method: "PATCH",
      params: {
        id: company.value.id,
      },
      body: {
        action: param,
        enabled,
        id,
      },
      failTitle: `Failed to update ${param} for game`,
    });
  }
  return new Proxy({} as { [key: string]: boolean }, {
    get(_target, prop, _reciever) {
      return company.value[param].includes(prop.toString());
    },
    set(_target, prop, value) {
      if (typeof value !== "boolean") return false;
      const id = prop.toString();
      const exists = company.value[param].findIndex((e) => e === id);
      if (value && exists == -1) {
        company.value[param].push(id);
      }
      if (!value && exists != -1) {
        company.value[param].splice(exists, 1);
      }
      tick(id, value);
      return true;
    },
  });
}

const published = buildToggleProxy("published");
const developed = buildToggleProxy("developed");

async function removeGame(gameId: string) {
  await $dropFetch("/api/v1/admin/company/:id/game", {
    params: {
      id: company.value.id,
    },
    body: {
      id: gameId,
    },
    method: "DELETE",
    failTitle: "Failed to remove game",
  });
  const gameIndex = games.value.findIndex((e) => e.id == gameId);
  if (gameIndex == -1) return;
  games.value.splice(gameIndex, 1);

  const publishedIndex = company.value.published.findIndex((e) => e === gameId);
  if (publishedIndex != -1) {
    company.value.published.splice(publishedIndex, 1);
  }

  const developedIndex = company.value.developed.findIndex((e) => e === gameId);
  if (developedIndex != -1) {
    company.value.developed.splice(developedIndex, 1);
  }
}

function appendGame(
  game: (typeof games.value)[number],
  published: boolean,
  developed: boolean,
) {
  games.value.push(game);
  if (published) {
    company.value.published.push(game.id);
  }
  if (developed) {
    company.value.developed.push(game.id);
  }
}
</script>
