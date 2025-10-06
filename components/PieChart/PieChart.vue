<template>
  <div class="">
    <h2 v-if="title" class="text-lg mb-4">{{ title }}</h2>
    <svg
      ref="parentRef"
      width="100"
      height="100"
      class="relative inline"
      viewbox="0 0 100 100"
    >
      <PieChartPieSlice
        v-for="slice in generateSlices(data)"
        :key="`${slice.percentage}-${slice.totalPercentage}`"
        :slice="slice"
        :parent-ref="parentRef"
      />
    </svg>
    <PieChartTooltip />
  </div>
</template>

<script setup lang="ts">
import { generateSlices } from "~/components/PieChart/utils";
import type { SliceData } from "~/components/PieChart/types";

const { data, title = undefined } = defineProps<{
  data: SliceData[];
  title?: string | undefined;
}>();

const parentRef = ref<HTMLDivElement>();
</script>
