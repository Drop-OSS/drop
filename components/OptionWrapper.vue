<template>
  <div
    v-bind:class="{ 'border-blue-400': active, 'border-gray-400': !active }"
    class="border border-3 rounded-xl relative cursor-pointer"
  >
    <div v-if="active" class="absolute top-1 right-1 z-1">
      <div class="border-2 p-1 border-blue-400 rounded-xl bg-blue-400">
        <CheckIcon
          class="size-4 text-transparent font-bold stroke-5 stroke-black"
        />
      </div>
    </div>

    <slot />
  </div>
</template>

<script setup lang="ts">
import { CheckIcon } from "@heroicons/vue/24/outline";
const { active = false } = defineProps<{ active?: boolean }>();
</script>
