<script setup lang="ts">
import { CheckCircleIcon } from "@heroicons/vue/24/outline";
</script>

<template>
  <div class="min-h-full w-full flex items-center justify-center py-24">
    <div class="flex flex-col items-center">
      <CheckCircleIcon class="h-12 w-12 text-green-600" aria-hidden="true" />
      <div class="mt-3 text-center sm:mt-5">
        <h1 class="text-3xl font-semibold font-display leading-6 text-zinc-100">
          {{ $t("auth.2fa.success.title") }}
        </h1>
        <div class="mt-4">
          <p class="mx-auto text-sm text-zinc-400 max-w-sm">
            {{ $t("auth.2fa.success.description") }}
          </p>

          <div class="mt-10 flex justify-center">
            <NuxtLink
              href="/account/security"
              class="text-sm/6 font-semibold text-blue-400"
              ><i18n-t
                keypath="auth.2fa.success.back"
                tag="span"
                scope="global"
              >
                <template #arrow>
                  <span aria-hidden="true">{{ $t("chars.arrowBack") }}</span>
                </template>
              </i18n-t></NuxtLink
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
