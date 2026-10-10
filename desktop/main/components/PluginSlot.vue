<template>
  <template v-for="item in slotComponents" :key="item.id">
    <PluginErrorBoundary :plugin-id="item.pluginId">
      <component :is="item.component" v-bind="context" />
    </PluginErrorBoundary>
  </template>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { UISlotName } from "~/internal/plugins/types";
import { clientPluginManager } from "~/internal/plugins/ClientPluginManager";
import PluginErrorBoundary from "~/internal/plugins/PluginErrorBoundary.vue";

const props = defineProps<{
  name: UISlotName;
  context?: Record<string, unknown>;
}>();

const slotComponents = computed(() => {
  return clientPluginManager.slots[props.name] || [];
});
</script>
