<template>
  <path
    v-if="slice.percentage !== 0 && slice.percentage !== 100"
    :class="[CHART_COLOURS[slice.color].fill]"
    :d="`
      M ${slice.start}
      A ${slice.radius},${slice.radius} 0 ${getFlags(slice.percentage)} ${polarToCartesian(slice.center, slice.radius, percent2Degrees(slice.totalPercentage))}
      L ${slice.center}
      z
    `"
    stroke-width="2"
  />
  <circle
    v-if="slice.percentage === 100"
    :r="slice.radius"
    :cx="slice.center.x"
    :cy="slice.center.y"
    :class="[CHART_COLOURS[slice.color].fill]"
    stroke-width="2"
  />
</template>

<script setup lang="ts">
import type { Slice } from "~/components/PieChart/types";
import {
  getFlags,
  percent2Degrees,
  polarToCartesian,
} from "~/components/PieChart/utils";
import { CHART_COLOURS } from "~/utils/colors";

const { slice } = defineProps<{
  slice: Slice;
}>();
</script>
