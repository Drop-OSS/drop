<template>
  <div class="min-h-full w-full flex items-center justify-center">
    <div class="flex flex-col items-center">
      <div class="text-center">
        <h1 class="text-3xl font-semibold font-display leading-6 text-ink-100">
          Device authorization
        </h1>
        <div class="mt-4">
          <p class="text-sm text-ink-400 max-w-md mx-auto">
            Open Drop on another one of your devices, and use your account
            dropdown to "Authorize client", and enter the code below.
          </p>
          <div
            class="mt-8 flex items-center justify-center gap-x-5 text-8xl font-bold text-ink-100"
          >
            <span v-for="letter in code.split('')">{{ letter }}</span>
          </div>
        </div>
        <div class="mt-10 flex items-center justify-center gap-x-6">
          <NuxtLink href="/auth" class="text-sm font-semibold text-accent-600"
            ><span aria-hidden="true">&larr;</span> Use a different method
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";

const code = await invoke<string>("auth_initiate_code");

definePageMeta({
  layout: "mini",
});
</script>
