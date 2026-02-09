<template>
  <h2 v-if="title" class="text-lg mb-4 w-full">{{ title }}</h2>
  <div class="flex">
    <div class="flex flex-col md:flex-row xl:gap-4 mx-auto">
      <div class="relative flex max-w-[12rem] my-auto min-w-50">
        <svg class="aspect-square grow relative inline" viewBox="0 0 100 100">
          <PieChartPieSlice
            v-for="slice in slices"
            :key="`${slice.percentage}-${slice.totalPercentage}`"
            :slice="slice"
          />
        </svg>
        <div class="absolute inset-0 bg-zinc-900 rounded-full m-12" />
      </div>
      <ul class="flex flex-col gap-y-1 m-auto text-left">
        <li
          v-for="slice in slices"
          :key="slice.value"
          class="text-sm inline-flex items-center gap-x-1"
        >
          <span
            class="size-3 inline-block rounded-sm"
            :class="CHART_COLOURS[slice.color].bg"
          />
          {{
            $t("common.labelValueColon", {
              label: slice.label,
              value: $n(slice.value),
            })
          }}
        </li>
      </ul>
    </div>
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
