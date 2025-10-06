<template>
  <table class="w-full table-fixed border-separate border-spacing-2 text-right">
    <thead>
      <tr>
        <th class="w-[15%]">Source</th>
        <th class="w-[15%]">Base dir</th>
        <th class="w-[15%]">Total space</th>
        <th class="w-[15%]">Available space</th>
        <th class="w-[40%]">Usage</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="source in sources" :key="source.id">
        <SourceSummaryRow :source="source" />
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import type { LibraryWithMetadata } from "~/server/internal/library";
const { sources } = defineProps<{
  sources: LibraryWithMetadata[];
}>();
</script>
