<template>
  <div
    :class="[
      'transition border border-3 rounded-xl relative cursor-pointer',
      active ? 'border-blue-600' : 'border-zinc-700',
    ]"
  >
    <div v-if="active" class="absolute top-1 right-1 z-1">
        <CheckIcon
          class="rounded-full p-1.5 bg-blue-600 size-6 text-transparent stroke-3 stroke-zinc-900 font-bold"
        />
    </div>

    <slot />
  </div>
</template>

<script setup lang="ts">
import { CheckIcon } from '@heroicons/vue/24/solid';

const { active = false } = defineProps<{ active?: boolean }>();
</script>
