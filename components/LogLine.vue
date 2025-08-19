<template>
  <span class="text-xs font-mono text-zinc-400 inline-flex items-top gap-x-2"
    ><span v-if="!short" class="text-zinc-500">{{ log.timestamp }}</span>
    <span
      :class="[
        colours[log.level] || 'text-green-400',
        'uppercase font-display font-semibold',
      ]"
      >{{ log.level }}</span
    >
    <pre :class="[short ? 'line-clamp-1' : '', 'mt-[1px]']">{{ log.message }}</pre>
  </span>
</template>

<script setup lang="ts">
import type { TaskLog } from "~/server/internal/tasks";

defineProps<{ log: typeof TaskLog.infer; short?: boolean }>();

const colours: { [key: string]: string } = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
};
</script>
