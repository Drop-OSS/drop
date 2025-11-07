<template>
  <div
    :class="[
      'border border-zinc-800 rounded-xl h-full px-6 py-4 relative bg-zinc-950/30',
      { 'min-h-50 pb-15': link, 'lg:pb-4': !link },
    ]"
  >
    <h1
      v-if="props.title"
      :class="[
        'font-semibold text-lg w-full',
        { 'mb-3': !props.subtitle && link },
      ]"
    >
      {{ props.title }}
      <div v-if="rightTitle" class="float-right">{{ props.rightTitle }}</div>
    </h1>
    <h2
      v-if="props.subtitle"
      :class="['text-zinc-400 text-sm w-full', { 'mb-3': link }]"
    >
      {{ props.subtitle }}
      <div v-if="rightTitle" class="float-right">{{ props.rightTitle }}</div>
    </h2>

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
  title?: string;
  subtitle?: string;
  rightTitle?: string;
  link?: {
    url: string;
    label: string;
  };
}>();
</script>
