<template>
  <div
    :class="[
      'relative h-5 rounded-xl overflow-hidden',
      COLORS[backgroundColor].bg,
    ]"
  >
    <div
      :style="{ width: `${percentage}%` }"
      :class="['transition-all h-full', COLORS[color].bg]"
    />
    <span
      class="absolute inset-0 flex items-center justify-center text-blue-200 text-sm font-bold font-display"
    >
      {{ $t("tasks.admin.progress", [Math.round(percentage * 10) / 10]) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { type COLOR, COLORS } from "~/utils/colors";
const {
  percentage,
  color = "blue",
  backgroundColor = "zinc",
} = defineProps<{
  percentage: number;
  color?: COLOR;
  backgroundColor?: COLOR;
}>();
</script>
