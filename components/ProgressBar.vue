<template>
  <div :class="['h-3 w-full rounded-sm inline-block', COLORS.slate.bg]">
    <div
      :style="`width: ${percentage}%`"
      :class="['h-full rounded-sm', COLORS[color].bg]"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { type COLOR, COLORS } from "~/utils/colors";
const { percentage, color } = defineProps<{
  percentage: number;
  color: COLOR;
}>();
</script>
