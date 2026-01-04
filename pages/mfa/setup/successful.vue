<script setup lang="ts">
import { CheckCircleIcon } from "@heroicons/vue/24/outline";
</script>

<template>
  <div class="min-h-full w-full flex items-center justify-center py-24">
    <div class="flex flex-col items-center">
      <CheckCircleIcon class="h-12 w-12 text-green-600" aria-hidden="true" />
      <div class="mt-3 text-center sm:mt-5">
        <h1 class="text-3xl font-semibold font-display leading-6 text-zinc-100">
          Added your 2FA method!
        </h1>
        <div class="mt-4">
          <p class="mx-auto text-sm text-zinc-400 max-w-sm">
            Drop has successfully created and added your 2FA method. If this is
            your first time configuring 2FA, your account now requires it to
            sign in.
          </p>

          <div class="mt-10 flex justify-center">
            <NuxtLink
              href="/account/security"
              class="text-sm/6 font-semibold text-blue-400"
              ><span aria-hidden="true">&larr;</span> Back to account
              security</NuxtLink
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
