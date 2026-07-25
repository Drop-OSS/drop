<template>
  <div
    class="grid min-h-full grid-cols-1 grid-rows-[1fr,auto,1fr] lg:grid-cols-[max(50%,36rem),1fr]"
  >
    <header
      class="mx-auto w-full max-w-7xl px-6 pt-6 sm:pt-10 lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:px-8"
    >
      <Logo class="h-10 w-auto sm:h-12" />
    </header>
    <main
      class="mx-auto w-full max-w-7xl px-6 py-24 sm:py-32 lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:px-8"
    >
      <div class="max-w-lg">
        <h1 class="mt-4 text-3xl font-bold font-display tracking-tight text-zinc-100 sm:text-5xl">
          Server is unavailable
        </h1>
        <p class="mt-6 text-base leading-7 text-zinc-400">
          We were unable to contact your Drop instance. See if you can open it in your web browser,
          or contact your server admin for help.
        </p>
        <div class="mt-10 space-x-10">
          <button
            type="button"
            @click="() => retry()"
            class="inline-flex gap-x-2 items-center text-sm text-left font-semibold leading-7 text-white"
          >
            Retry <ArrowPathIcon class="w-5 h-5" />
          </button>
          <NuxtLink to="/setup" class="text-sm text-left font-semibold leading-7 text-blue-600">
            Connect to different instance <span aria-hidden="true">&rarr;</span>
          </NuxtLink>
        </div>
      </div>
    </main>
    <footer class="self-end lg:col-span-2 lg:col-start-1 lg:row-start-3">
      <div class="border-t border-blue-600 bg-zinc-900 py-10">
        <nav
          class="mx-auto flex w-full max-w-7xl items-center gap-x-4 px-6 text-sm leading-7 text-zinc-400 lg:px-8"
        >
          <a href="#">Documentation</a>
          <svg viewBox="0 0 2 2" aria-hidden="true" class="h-0.5 w-0.5 fill-zinc-700">
            <circle cx="1" cy="1" r="1" />
          </svg>
          <a href="#">Troubleshooting</a>
          <svg viewBox="0 0 2 2" aria-hidden="true" class="h-0.5 w-0.5 fill-zinc-700">
            <circle cx="1" cy="1" r="1" />
          </svg>
          <NuxtLink to="/setup/server">Switch instance</NuxtLink>
        </nav>
      </div>
    </footer>
    <div class="hidden lg:relative lg:col-start-2 lg:row-start-1 lg:row-end-4 lg:block">
      <img
        src="@/assets/wallpaper.jpg"
        alt=""
        class="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowPathIcon } from "@heroicons/vue/24/outline";
import { invoke } from "@tauri-apps/api/core";

definePageMeta({
  layout: "mini",
});

async function retry() {
  await invoke("retry_connect");
  location.reload();
}
</script>
