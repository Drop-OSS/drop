<template>
  <div class="px-4 sm:px-5 py-4" hydrate-on-visible>
    <h1 class="text-zinc-100 text-2xl font-bold font-display">
      {{ props.title }}
    </h1>
    <NuxtLink
      href="#"
      class="hidden text-sm font-semibold text-blue-600 hover:text-blue-500 sm:block"
    >
      <i18n-t keypath="store.exploreMore" tag="span" scope="global">
        <template #arrow>
          <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
        </template>
      </i18n-t>
    </NuxtLink>
    <div class="mt-4">
      <GameCarousel :items="source" :min="12" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TitleSourceValidatorType } from "~/server/internal/store/types";

const props = defineProps<TitleSourceValidatorType>();

const source = await useStoreSource(props.source, 24);
</script>
