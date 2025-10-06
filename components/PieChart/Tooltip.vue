<template>
  <div
    id="tooltip"
    :style="`top: ${tooltip.y}px; left: ${tooltip.x}px; ${!tooltip.isDisplayed && 'display: none;'}`"
    class="absolute"
  >
    <div
      v-if="tooltip.slice"
      ref="parentRef"
      :style="`color: ${COLORS[tooltip.slice.color]}`"
      class="p-2 border-2 border-blue-200 bg-zinc-900 font-bold"
    >
      {{ tooltip.slice.label }}: {{ tooltip.slice.value }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTooltip } from "../../composables/piechart";
import { COLORS } from "~/utils/const";

const tooltip = useTooltip();
</script>
