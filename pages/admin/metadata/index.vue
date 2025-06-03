<template>
  <div class="space-y-4">
    <div class="mx-auto max-w-2xl lg:mx-0">
      <h2
        class="mt-2 text-xl font-semibold tracking-tight text-zinc-100 sm:text-3xl"
      >
        Metadata
      </h2>
      <p
        class="mt-2 text-pretty text-sm font-medium text-gray-500 sm:text-md/8"
      >
        Manage the metadata of your library, and update relationships between
        them. Users will be able to search through this metadata to find the
        games they want.
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-5 gap-8">
      <NuxtLink
        to="/admin/metadata/games"
        class="transition group aspect-[3/2] flex flex-col justify-center items-center rounded-lg bg-zinc-950 hover:bg-zinc-950/50 shadow"
      >
        <RectangleStackIcon class="mb-2 h-12 w-12 text-zinc-500 group-hover:text-blue-500 transition-all duration-200" />
        <span
          class="transition-all text-4xl font-bold text-zinc-400 group-hover:text-zinc-100 uppercase tracking-widest"
          >Games</span
        >
      </NuxtLink>
      <NuxtLink
        to="/admin/metadata/companies"
        class="transition group aspect-[3/2] flex flex-col justify-center items-center rounded-lg bg-zinc-950 hover:bg-zinc-950/50 shadow"
      >
        <BuildingOffice2Icon class="mb-2 h-12 w-12 text-zinc-500 group-hover:text-blue-500 transition-all duration-200" />
        <span
          class="transition-all text-4xl font-bold text-zinc-400 group-hover:text-zinc-100 uppercase tracking-widest"
          >Companies</span
        >
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RectangleStackIcon, BuildingOffice2Icon } from "@heroicons/vue/24/solid";

definePageMeta({
  layout: "admin",
});

useHead({
  title: "Metadata",
});
</script>
