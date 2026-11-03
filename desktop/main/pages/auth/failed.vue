<template>
  <div class="min-h-full w-full flex items-center justify-center">
    <div class="flex flex-col items-center">
      <XCircleIcon class="h-12 w-12 text-red-600" aria-hidden="true" />
      <div class="mt-3 text-center sm:mt-5">
        <h1 class="text-3xl font-semibold font-display leading-6 text-ink-100">
          Authentication failed
        </h1>
        <div class="mt-4">
          <p class="text-sm text-ink-400 max-w-sm">
            Drop encountered an error while connecting to your instance. Error:
            {{ message }}
          </p>
        </div>
        <div class="mt-10 flex items-center justify-center gap-x-6">
          <NuxtLink href="/auth" class="text-sm font-semibold text-ink-100"
            ><span aria-hidden="true">&larr;</span> Back to authentication
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XCircleIcon } from "@heroicons/vue/16/solid";

const route = useRoute();
const message = route.query.error ?? "An unknown error occurred";

definePageMeta({
  layout: "mini",
});
</script>
