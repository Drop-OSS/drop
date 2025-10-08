<template>
  <div
    :style="`background-color: ${COLORS.lightgray}`"
    class="h-3 w-full rounded-sm inline-block"
  >
    <div
      :style="`width: ${percentage}%; background-color: ${COLORS[color]}`"
      class="h-full rounded-sm"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { type COLOR, COLORS } from "~/utils/const";
const { percentage, color } = defineProps<{
  percentage: number;
  color: COLOR;
}>();
</script>
