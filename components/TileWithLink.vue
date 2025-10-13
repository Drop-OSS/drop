<template>
  <div
    :class="[
      'border-2 border-gray-800 rounded-xl h-full p-4 relative bg-gray-900',
      { 'min-h-50 pb-8': link },
    ]"
  >
    <h1 :class="['font-bold text-lg w-full', { 'mb-3': link }]">
      {{ props.title }}
      <div v-if="rightTitle" class="float-right">{{ props.rightTitle }}</div>
    </h1>

    <slot />

    <div v-if="props.link" class="absolute bottom-5 right-5">
      <NuxtLink
        :to="props.link.url"
        class="transition text-sm/6 font-semibold text-zinc-400 hover:text-zinc-100 inline-flex gap-x-2 items-center duration-200 hover:scale-105"
      >
        {{ props.link.label }}
        <ArrowRightIcon class="h-4 w-4" aria-hidden="true" />
      </NuxtLink>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ArrowRightIcon } from "@heroicons/vue/20/solid";

const props = defineProps<{
  title: string;
  rightTitle?: string;
  link?: {
    url: string;
    label: string;
  };
}>();
</script>
