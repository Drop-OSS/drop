<template>
  <h2 v-if="title" class="text-lg mb-4 w-full">{{ title }}</h2>
  <div class="flex">
    <div class="flex-auto mx-auto">
      <svg
        width="100"
        height="100"
        class="relative inline"
        viewbox="0 0 100 100"
      >
        <PieChartPieSlice
          v-for="slice in slices"
          :key="`${slice.percentage}-${slice.totalPercentage}`"
          :slice="slice"
        />
      </svg>
    </div>
    <ul class="flex-auto m-auto text-left">
      <li v-for="slice in slices" :key="slice.value">
        <span
          class="w-3 h-3 inline-block border-slate-100 border-solid border-1"
          :class="COLORS[slice.color].bg"
        />
        {{
          $t("common.labelValueColon", {
            label: slice.label,
            value: slice.value,
          })
        }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { generateSlices } from "~/components/PieChart/utils";
import type { SliceData } from "~/components/PieChart/types";

const { data, title = undefined } = defineProps<{
  data: SliceData[];
  title?: string | undefined;
}>();

const slices = generateSlices(data);
</script>
