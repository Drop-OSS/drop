<template>
  <div
    v-if="hasError"
    class="inline-flex items-center gap-x-1 text-xs text-red-400 bg-red-950/40 border border-red-500/30 rounded px-2 py-1"
    :title="errorMessage"
  >
    <span class="font-mono text-[10px] font-semibold uppercase"
      >Plugin Error</span
    >
    <span v-if="pluginId" class="text-zinc-400 font-mono text-[10px]"
      >({{ pluginId }})</span
    >
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from "vue";

const props = defineProps<{
  pluginId?: string;
}>();

const hasError = ref(false);
const errorMessage = ref("");

onErrorCaptured((err) => {
  hasError.value = true;
  errorMessage.value = err instanceof Error ? err.message : String(err);
  console.error(
    `[PluginErrorBoundary] Error in plugin component '${props.pluginId}':`,
    err,
  );
  // Prevent propagating the error to the top-level app error handler
  return false;
});
</script>
