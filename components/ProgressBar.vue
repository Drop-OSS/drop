<template>
  <div
    :class="[
      'relative h-5 rounded-xl overflow-hidden',
      CHART_COLOURS[backgroundColor].bg,
    ]"
  >
    <div
      :style="{ width: `${percentage}%` }"
      :class="['transition-all h-full', CHART_COLOURS[color].bg]"
    />
    <span
      class="absolute inset-0 flex items-center justify-center text-blue-200 text-sm font-bold font-display"
    >
      <!-- {{ $t("tasks.admin.progress", [Math.round(percentage * 10) / 10]) }} -->
      {{ $n(Math.round(percentage) / 100, "percent") }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { type ChartColour, CHART_COLOURS } from "~/utils/colors";
const {
  percentage,
  color = "blue",
  backgroundColor = "zinc",
} = defineProps<{
  percentage: number;
  color?: ChartColour;
  backgroundColor?: ChartColour;
}>();
</script>
