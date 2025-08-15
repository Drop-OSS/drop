<template>
  <div>
    <LanguageSelectorListbox />
    <NuxtLink class="mt-1 transition text-blue-500 hover:text-blue-600 text-sm"
      to="https://translate.droposs.org/engage/drop/" target="_blank">
      <i18n-t keypath="helpUsTranslate" tag="span" scope="global"
        class="inline-flex items-center gap-x-1 hover:underline">
        <template #arrow>
          <ArrowTopRightOnSquareIcon class="size-4" />
        </template>
      </i18n-t>
    </NuxtLink>

    <DevOnly>
      <h1 class="mt-3 text-sm text-gray-500">{{ $t("welcome") }}</h1>
    </DevOnly>
  </div>
</template>

<script setup lang="ts">
import { ArrowTopRightOnSquareIcon } from "@heroicons/vue/24/outline";
</script>