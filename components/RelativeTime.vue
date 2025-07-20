<template>
  <div class="relative inline-block group/relative-time">
    <!-- Visible relative time -->
    <time :datetime="isoDate" class="text-sm text-muted-foreground">
      {{ DateTime.fromJSDate(date).toRelative({ locale: $i18n.locale }) }}
    </time>

    <!-- Custom tooltip that shows on hover -->
    <div
      role="tooltip"
      class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-zinc-900 text-white text-xs whitespace-nowrap shadow z-10 opacity-0 group-hover/relative-time:opacity-100 transition-opacity pointer-events-none"
      aria-hidden="true"
    >
      {{ $d(date, "long") }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { DateTime } from "luxon";
import { computed } from "vue";

const props = defineProps<{
  date: string | Date;
}>();

const date = computed(() =>
  typeof props.date === "string" ? new Date(props.date) : props.date,
);

const isoDate = computed(() => date.value.toISOString());
</script>
