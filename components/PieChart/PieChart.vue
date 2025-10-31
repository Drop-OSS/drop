<template>
  <h2 v-if="title" class="text-lg mb-4 w-full">{{ title }}</h2>
  <div class="flex">
    <div class="flex-auto mx-auto">
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
    </div>
    <ul class="flex-auto m-auto">
      <li v-for="slice in data" :key="slice.value">
        {{
          $t("common.labelValueColon", {
            label: slice.label,
            value: slice.value,
          })
        }}
      </li>
    </ul>
  </div>
  <PieChartTooltip />
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
