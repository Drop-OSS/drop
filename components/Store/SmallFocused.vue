<template>
  <div>
    <div class="px-4 py-8 sm:px-6 sm:py-12">
      <div v-if="source" class="relative overflow-hidden rounded-lg lg:h-96">
        <div class="absolute inset-0">
          <img
            :src="useObject(source.mBannerObjectId)"
            alt=""
            class="size-full object-cover"
          />
        </div>
        <div aria-hidden="true" class="relative h-96 w-full lg:hidden" />
        <div aria-hidden="true" class="relative h-32 w-full lg:hidden" />
        <div
          class="absolute inset-x-0 bottom-0 rounded-br-lg rounded-bl-lg bg-black/75 p-6 backdrop-blur-sm backdrop-filter sm:flex sm:items-center sm:justify-between lg:inset-x-auto lg:inset-y-0 lg:w-96 lg:flex-col lg:items-start lg:rounded-tl-lg lg:rounded-br-none"
        >
          <div>
            <h2 class="text-xl font-bold text-white">{{ source.mName }}</h2>
            <p class="mt-1 text-sm text-gray-300">
              {{ source.mShortDescription }}
            </p>
          </div>
          <NuxtLink
            href="#"
            class="mt-6 flex shrink-0 items-center justify-center rounded-md border border-white/25 px-4 py-3 text-base font-medium text-white hover:bg-white/10 sm:mt-0 sm:ml-8 lg:ml-0 lg:w-full"
          >
            <i18n-t keypath="store.explore" tag="span" scope="global">
              <template #arrow>
                <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
              </template>
            </i18n-t></NuxtLink
          >
        </div>
      </div>
      <div v-else class="relative overflow-hidden rounded-lg lg:h-96">
        <div class="absolute inset-0 bg-zinc-950" />

        <div aria-hidden="true" class="relative h-96 w-full lg:hidden" />
        <div aria-hidden="true" class="relative h-32 w-full lg:hidden" />
        <div
          class="absolute inset-x-0 bottom-0 rounded-br-lg rounded-bl-lg bg-black/75 p-6 backdrop-blur-sm backdrop-filter sm:flex sm:items-center sm:justify-between lg:inset-x-auto lg:inset-y-0 lg:w-96 lg:flex-col lg:items-start lg:rounded-tl-lg lg:rounded-br-none"
        >
          <div>
            <h2 class="text-xl font-bold text-zinc-400 uppercase">
              {{ $t("store.noGame") }}
            </h2>
          </div>
          <NuxtLink
            href="#"
            class="mt-6 flex shrink-0 items-center justify-center rounded-md border border-white/25 px-4 py-3 text-base font-medium text-white hover:bg-white/10 sm:mt-0 sm:ml-8 lg:ml-0 lg:w-full"
          >
            <i18n-t keypath="store.explore" tag="span" scope="global">
              <template #arrow>
                <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
              </template>
            </i18n-t></NuxtLink
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { JustSourceValidatorType } from "~/server/internal/store/types";

const props = defineProps<JustSourceValidatorType>();

const [source] = await useStoreSource(props.source, 1);
</script>
