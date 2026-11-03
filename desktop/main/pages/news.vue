<template>
  <div class="grow w-full h-full flex items-center justify-center">
    <div class="flex flex-col items-center">
      <WrenchScrewdriverIcon
        class="h-12 w-12 text-accent-600"
        aria-hidden="true"
      />
      <div class="mt-3 text-center sm:mt-5">
        <h1 class="text-3xl font-semibold font-display leading-6 text-ink-100">
          Under construction
        </h1>
        <div class="mt-4">
          <p class="text-sm text-ink-400 max-w-lg">
            This page hasn't been implemented yet.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import {
  WrenchScrewdriverIcon,
} from "@heroicons/vue/20/solid";
</script>
