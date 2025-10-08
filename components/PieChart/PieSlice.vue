<template>
  <path
    v-if="slice.percentage !== 0 && slice.percentage !== 100"
    :fill="COLORS[slice.color]"
    :d="`
      M ${slice.start}
      A ${slice.radius},${slice.radius} 0 ${getFlags(slice.percentage)} ${polarToCartesian(slice.center, slice.radius, percent2Degrees(slice.totalPercentage))}
      L ${slice.center}
      z
    `"
    stroke="white"
    stroke-width="2"
    @mousemove="
      (event) => {
        setTooltipCoordinates(parentRef, event.clientX, event.clientY, slice);
      }
    "
    @mouseleave="hideTooltip"
  />
  <circle
    v-if="slice.percentage === 100"
    :r="slice.radius"
    :cx="slice.center.x"
    :cy="slice.center.y"
    :fill="COLORS[slice.color]"
    stroke="white"
    stroke-width="2"
    @mousemove="
      (event) => {
        setTooltipCoordinates(parentRef, event.clientX, event.clientY, slice);
      }
    "
    @mouseleave="hideTooltip"
  />
</template>

<script setup lang="ts">
import type { Slice } from "~/components/PieChart/types";
import {
  getFlags,
  percent2Degrees,
  polarToCartesian,
} from "~/components/PieChart/utils";
import { hideTooltip, setTooltipCoordinates } from "~/composables/piechart";
import { COLORS } from "~/utils/const";

const { slice, parentRef } = defineProps<{
  slice: Slice;
  parentRef: HTMLDivElement | undefined;
}>();
</script>
