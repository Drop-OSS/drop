<template>
  <div class="text-gray-100">{{ $t("todo") }}</div>
</template>
<script lang="ts" setup>
useHead({
  title: "Settings",
});

definePageMeta({
  layout: "admin",
});
</script>
