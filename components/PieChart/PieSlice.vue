<template>
  <path
    :fill="slice.color"
    :d="`
      M ${slice.start}
      A ${slice.radius},${slice.radius} 0 ${getFlags(slice.percentage)} ${polarToCartesian(slice.center, slice.radius, percent2Degrees(slice.totalPercentage))}
      L ${slice.center}
      z
    `"
  />
</template>
<script setup lang="ts">
import Tuple from "~/utils/tuple";
import type { Slice } from "~/components/PieChart/types";
import { polarToCartesian } from "~/components/PieChart/utils";

const { slice } = defineProps<{ slice: Slice }>();
const percent2Degrees = (percentage: number) => (360 * percentage) / 100;
const getFlags = (percentage: number) =>
  percentage > 50 ? new Tuple(1, 1) : new Tuple(0, 1);
</script>
