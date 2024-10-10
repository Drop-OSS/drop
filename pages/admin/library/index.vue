<template>
  <div
    v-if="libraryState.unimportedGames.length > 0"
    class="rounded-md bg-blue-600/10 p-4 mb-4"
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
          Drop has detected you have new games to import.
        </p>
        <p class="mt-3 text-sm md:ml-6 md:mt-0">
          <NuxtLink
            href="/admin/library/import"
            class="whitespace-nowrap font-medium text-blue-400 hover:text-blue-500"
          >
            Import
            <span aria-hidden="true"> &rarr;</span>
          </NuxtLink>
        </p>
      </div>
    </div>
  </div>
  <ul
    role="list"
    class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
  >
    <li
      v-for="{ game, status } in libraryState.games"
      :key="game.id"
      class="col-span-1 flex flex-col justify-center divide-y divide-zinc-700 rounded-lg bg-zinc-950/20 text-left shadow"
    >
      <div class="flex flex-1 flex-row p-4 gap-x-4">
        <img
          class="mx-auto h-16 w-16 flex-shrink-0 rounded-md"
          :src="useObject(game.mIconId)"
          alt=""
        />
        <div class="flex-1 flex-col">
          <h3 class="text-sm font-medium text-zinc-100 font-display">
            {{ game.mName }}
          </h3>
          <dl class="mt-1 flex flex-grow flex-col justify-between">
            <dt class="sr-only">Short Description</dt>
            <dd class="text-sm text-zinc-400">{{ game.mShortDescription }}</dd>
            <dt class="sr-only">Metadata provider</dt>
            <dd class="mt-3">
              <span
                class="inline-flex items-center rounded-full bg-blue-600/10 px-2 py-1 text-xs font-medium text-blue-600 ring-1 ring-inset ring-blue-600/20"
                >{{ game.metadataSource }}</span
              >
            </dd>
          </dl>
        </div>
      </div>
      <div class="flex flex-col gap-y-2 p-2">
        <div
          v-if="status.unimportedVersions"
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
                Drop has detected you have new verions of this game to import.
              </p>
              <p class="mt-3 text-sm md:ml-6 md:mt-0">
                <NuxtLink
                  :href="`/admin/library/${game.id}/import`"
                  class="whitespace-nowrap font-medium text-blue-400 hover:text-blue-500"
                >
                  Import
                  <span aria-hidden="true"> &rarr;</span>
                </NuxtLink>
              </p>
            </div>
          </div>
        </div>
        <div v-if="status.noVersions" class="rounded-md bg-yellow-600/10 p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <ExclamationTriangleIcon
                class="h-5 w-5 text-yellow-600"
                aria-hidden="true"
              />
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-yellow-600">
                You have no versions of this game available.
              </h3>
            </div>
          </div>
        </div>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { ExclamationTriangleIcon } from "@heroicons/vue/16/solid";
import { InformationCircleIcon } from "@heroicons/vue/20/solid";
definePageMeta({
  layout: "admin",
});

useHead({
  title: "Libraries",
});

const headers = useRequestHeaders(["cookie"]);
const libraryState = await $fetch("/api/v1/admin/library", { headers });
</script>
