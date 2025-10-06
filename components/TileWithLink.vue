<template>
  <div
    :class="`border-2 border-zinc-100 rounded-xl p-4 relative ${link ? 'min-h-50' : 'min-h-30'}`"
  >
    <h1 class="font-bold text-xl">{{ props.title }}</h1>

    <div class="w-full p-6 text-center">
      <slot />
    </div>

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
  link?: {
    url: string;
    label: string;
  };
}>();
</script>
