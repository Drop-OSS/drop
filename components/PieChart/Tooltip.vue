<template>
  <div
    id="tooltip"
    :style="`top: ${tooltip.y}px; left: ${tooltip.x}px; ${!tooltip.isDisplayed && 'display: none;'}`"
    class="absolute"
  >
    <div
      v-if="tooltip.slice"
      ref="parentRef"
      :style="`color: ${COLORS[tooltip.slice.color].bg}`"
      class="p-2 border-2 border-blue-200 bg-zinc-900 font-bold"
    >
      {{
        $t("common.labelValueColon", {
          label: tooltip.slice.label,
          value: tooltip.slice.value,
        })
      }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTooltip } from "../../composables/piechart";
import { COLORS } from "~/utils/colors";

const tooltip = useTooltip();
</script>
