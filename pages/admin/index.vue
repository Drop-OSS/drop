<template>
  <div v-if="false" class="grid gap-4 lg:grid-cols-3 lg:grid-rows-2">
    <div class="relative lg:row-span-2">
      <div
        class="absolute inset-px rounded-lg bg-zinc-950 lg:rounded-l-[2rem]"
      />
      <div
        class="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)] lg:rounded-l-[calc(2rem+1px)]"
      >
        <div class="px-8 pt-8 pb-3 sm:px-10 sm:py-10">
          <p
            class="mt-2 text-lg font-medium tracking-tight text-zinc-100 max-lg:text-center"
          >
            Library
          </p>
          <p class="mt-2 max-w-lg text-sm/6 text-zinc-400 max-lg:text-center">
            Manage your Drop library, and import new games. Your library is the
            list of all games currently configured on this instance.
          </p>
          <p class="mt-3 text-sm">
            <NuxtLink
              href="/admin/library"
              class="whitespace-nowrap font-medium text-blue-400 hover:text-blue-500"
            >
              Check it out
              <span aria-hidden="true"> &rarr;</span>
            </NuxtLink>
          </p>

          <div v-if="toImport" class="mt-2 rounded-md bg-blue-600/10 p-4">
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
        </div>
      </div>
      <div
        class="pointer-events-none absolute inset-px rounded-lg ring-1 shadow-sm ring-black/5 lg:rounded-l-[2rem]"
      />
    </div>
    <div class="relative max-lg:row-start-1">
      <div
        class="absolute inset-px rounded-lg bg-zinc-950 max-lg:rounded-t-[2rem]"
      />
      <div
        class="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)] max-lg:rounded-t-[calc(2rem+1px)]"
      >
        <div class="px-8 py-8 sm:px-10 sm:py-10">
          <p
            class="mt-2 text-lg font-medium tracking-tight text-zinc-100 max-lg:text-center"
          >
            Users
          </p>
          <p class="mt-2 max-w-lg text-sm/6 text-zinc-400 max-lg:text-center">
            Your users are people who can access your Drop instance, download
            games from it, and configure API keys for it.
          </p>
          <p class="mt-3 text-sm">
            <NuxtLink
              href="/admin/users"
              class="whitespace-nowrap font-medium text-blue-400 hover:text-blue-500"
            >
              Check it out
              <span aria-hidden="true"> &rarr;</span>
            </NuxtLink>
          </p>
        </div>
      </div>
      <div
        class="pointer-events-none absolute inset-px rounded-lg ring-1 shadow-sm ring-black/5 max-lg:rounded-t-[2rem]"
      />
    </div>
    <div class="relative max-lg:row-start-3 lg:col-start-2 lg:row-start-2">
      <div class="absolute inset-px rounded-lg bg-white" />
      <div
        class="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)]"
      >
        <div class="px-8 pt-8 sm:px-10 sm:pt-10">
          <p
            class="mt-2 text-lg font-medium tracking-tight text-gray-950 max-lg:text-center"
          >
            Security
          </p>
          <p class="mt-2 max-w-lg text-sm/6 text-gray-600 max-lg:text-center">
            Morbi viverra dui mi arcu sed. Tellus semper adipiscing suspendisse
            semper morbi.
          </p>
        </div>
        <div class="@container flex flex-1 items-center max-lg:py-6 lg:pb-2">
          <img
            class="h-[min(152px,40cqw)] object-cover"
            src="https://tailwindcss.com/plus-assets/img/component-images/bento-03-security.png"
            alt=""
          />
        </div>
      </div>
      <div
        class="pointer-events-none absolute inset-px rounded-lg ring-1 shadow-sm ring-black/5"
      />
    </div>
    <div class="relative lg:row-span-2">
      <div
        class="absolute inset-px rounded-lg bg-white max-lg:rounded-b-[2rem] lg:rounded-r-[2rem]"
      />
      <div
        class="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)] max-lg:rounded-b-[calc(2rem+1px)] lg:rounded-r-[calc(2rem+1px)]"
      >
        <div class="px-8 pt-8 pb-3 sm:px-10 sm:pt-10 sm:pb-0">
          <p
            class="mt-2 text-lg font-medium tracking-tight text-gray-950 max-lg:text-center"
          >
            Powerful APIs
          </p>
          <p class="mt-2 max-w-lg text-sm/6 text-gray-600 max-lg:text-center">
            Sit quis amet rutrum tellus ullamcorper ultricies libero dolor eget
            sem sodales gravida.
          </p>
        </div>
        <div class="relative min-h-[30rem] w-full grow">
          <div
            class="absolute top-10 right-0 bottom-0 left-10 overflow-hidden rounded-tl-xl bg-gray-900 shadow-2xl"
          >
            <div class="flex bg-gray-800/40 ring-1 ring-white/5">
              <div class="-mb-px flex text-sm/6 font-medium text-gray-400">
                <div
                  class="border-r border-b border-r-white/10 border-b-white/20 bg-white/5 px-4 py-2 text-white"
                >
                  NotificationSetting.jsx
                </div>
                <div class="border-r border-gray-600/10 px-4 py-2">App.jsx</div>
              </div>
            </div>
            <div class="px-6 pt-6 pb-14">
              <!-- Your code example -->
            </div>
          </div>
        </div>
      </div>
      <div
        class="pointer-events-none absolute inset-px rounded-lg ring-1 shadow-sm ring-black/5 max-lg:rounded-b-[2rem] lg:rounded-r-[2rem]"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { InformationCircleIcon } from "@heroicons/vue/24/solid";

definePageMeta({
  layout: "admin",
});

useHead({
  title: "Home",
});

const libraryState = await $dropFetch("/api/v1/admin/library");
const toImport = Object.entries(libraryState.unimportedGames).length > 0;
</script>
