<template>
  <div class="flex flex-col w-full min-h-screen bg-zinc-900">
    <UserHeader class="z-50" />
    <div class="grow flex">
      <NuxtPage />
    </div>
    <UserFooter class="z-50" />
  </div>
</template>

<script setup lang="ts">
useHead({
  titleTemplate(title) {
    if (title) return `${title} | Drop`;
    return `Drop`;
  },
});
</script>
