<template>
  <div>
    <svg
      style="width: 200px; height: 200px; padding: 20px"
      viewbox="0 0 100 100"
    >
      <PieChartPieSlice
        v-for="slice in generateSlices(data)"
        :key="`${slice.percentage}-${slice.totalPercentage}`"
        :slice="slice"
        :start="START"
        :radius="RADIUS"
        :percentage="60"
        :center="CENTER"
        :total-percentage="60"
        color="red"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import {
  START,
  RADIUS,
  CENTER,
  generateSlices,
} from "~/components/PieChart/utils";
import type { SliceData } from "~/components/PieChart/types";

const { data } = defineProps<{ data: SliceData[] }>();
</script>
