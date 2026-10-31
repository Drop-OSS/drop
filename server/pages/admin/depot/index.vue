<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="border-b border-zinc-800 pb-5 sm:flex sm:items-center sm:justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-zinc-100 font-display">
          Store Ingestion Depots
        </h2>
        <p class="mt-2 text-sm text-zinc-400">
          Connect external digital storefront accounts (GOG, Epic Games) to catalog and ingest offline installers and chunked archives.
        </p>
      </div>
      <div class="mt-4 sm:ml-4 sm:mt-0 flex gap-3">
        <button
          type="button"
          class="inline-flex items-center gap-x-2 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-xs transition-all duration-200 hover:bg-blue-500 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          @click="openConnectModal = true"
        >
          <PlusIcon class="-ml-0.5 size-5" aria-hidden="true" />
          Connect Storefront
        </button>
      </div>
    </div>

    <!-- Store Integrations Cards -->
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <!-- GOG Card -->
      <div class="relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-sm backdrop-blur-xs transition duration-200 hover:border-zinc-700">
        <div>
          <div class="flex items-center justify-between">
            <span class="inline-flex items-center rounded-md bg-purple-400/10 px-2.5 py-1 text-xs font-medium text-purple-400 ring-1 ring-inset ring-purple-400/30">
              DRM-Free
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs text-zinc-400">
              <span class="size-1.5 rounded-full bg-emerald-500"></span> Ready
            </span>
          </div>
          <div class="mt-4">
            <h3 class="text-lg font-semibold text-zinc-100 font-display">GOG Galaxy Pipeline</h3>
            <p class="mt-2 text-sm text-zinc-400">
              Ingest standalone offline installers, patches, DLC packages, and official extras directly from GOG accounts.
            </p>
          </div>
        </div>
        <div class="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
          <span class="text-xs text-zinc-500">OAuth2 Headless Flow</span>
          <NuxtLink
            to="/admin/depot/gog"
            class="inline-flex items-center text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            Configure
            <ArrowRightIcon class="ml-1 size-4" />
          </NuxtLink>
        </div>
      </div>

      <!-- Epic Games Card -->
      <div class="relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-sm backdrop-blur-xs transition duration-200 hover:border-zinc-700">
        <div>
          <div class="flex items-center justify-between">
            <span class="inline-flex items-center rounded-md bg-zinc-400/10 px-2.5 py-1 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-zinc-400/20">
              Manifest Ingestion
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs text-zinc-400">
              <span class="size-1.5 rounded-full bg-amber-500"></span> Planned
            </span>
          </div>
          <div class="mt-4">
            <h3 class="text-lg font-semibold text-zinc-100 font-display">Epic Games Store</h3>
            <p class="mt-2 text-sm text-zinc-400">
              Sync owned titles via Legendary CLI tokens and capture chunk manifests for direct depot indexing.
            </p>
          </div>
        </div>
        <div class="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
          <span class="text-xs text-zinc-500">Legendary Auth</span>
          <span class="text-xs text-zinc-500 italic">Phase 2 Milestone</span>
        </div>
      </div>

      <!-- Multi-part / Archive Ingest Card -->
      <div class="relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-sm backdrop-blur-xs transition duration-200 hover:border-zinc-700">
        <div>
          <div class="flex items-center justify-between">
            <span class="inline-flex items-center rounded-md bg-blue-400/10 px-2.5 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/30">
              Disc & Sets
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs text-zinc-400">
              <span class="size-1.5 rounded-full bg-emerald-500"></span> Active
            </span>
          </div>
          <div class="mt-4">
            <h3 class="text-lg font-semibold text-zinc-100 font-display">Multi-part Archives</h3>
            <p class="mt-2 text-sm text-zinc-400">
              Heuristics engine to group multi-disc installers (.bin, .iso, split archives) into single unified library entries.
            </p>
          </div>
        </div>
        <div class="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
          <span class="text-xs text-zinc-500">Auto Heuristics</span>
          <span class="text-xs text-zinc-400 font-medium">Automatic</span>
        </div>
      </div>
    </div>

    <!-- Active Connections Table -->
    <div class="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden shadow-xs">
      <div class="px-6 py-4 border-b border-zinc-800">
        <h3 class="text-base font-semibold text-zinc-100 font-display">Connected Store Accounts</h3>
        <p class="text-xs text-zinc-400 mt-1">Managed store sync instances and active background workers.</p>
      </div>

      <div class="p-6 text-center text-zinc-400">
        <ArchiveBoxIcon class="mx-auto size-12 text-zinc-600 mb-3" />
        <h4 class="text-sm font-medium text-zinc-200">No Storefront Accounts Linked</h4>
        <p class="mt-1 text-xs text-zinc-500">Link a GOG account to begin syncing offline installer packages and extras.</p>
        <button
          type="button"
          class="mt-4 inline-flex items-center gap-x-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition"
          @click="openConnectModal = true"
        >
          <PlusIcon class="size-4" /> Link GOG Account
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { PlusIcon, ArrowRightIcon, ArchiveBoxIcon } from "@heroicons/vue/24/outline";

definePageMeta({
  layout: "admin",
});

const openConnectModal = ref(false);
</script>
