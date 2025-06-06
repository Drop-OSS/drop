<template>
  <div class="text-gray-100">{{ liveRunningTasks }} {{ historicalTasks }}</div>
</template>
<script lang="ts" setup>
useHead({
  title: "Tasks",
});

definePageMeta({
  layout: "admin",
});

const { runningTasks, historicalTasks } =
  await $dropFetch("/api/v1/admin/task");

const liveRunningTasks = await Promise.all(runningTasks.map((e) => useTask(e)));
</script>
