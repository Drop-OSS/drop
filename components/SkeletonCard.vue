<template>
  <div
    :class="[
      'rounded-lg w-48 h-64 bg-zinc-800/50 flex items-center justify-center transition-all duration-300 hover:bg-zinc-800',
      props.loading && 'animate-pulse',
    ]"
  >
    <p class="text-zinc-700 text-sm font-semibold font-display uppercase">
      {{ props.message }}
    </p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  message?: string;
  loading?: boolean;
}>();
</script>
