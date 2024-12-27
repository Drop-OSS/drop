<template>
  <div v-if="!noWrapper" class="flex flex-col w-full min-h-screen bg-zinc-900">
    <UserHeader class="z-50" />
    <div class="grow flex">
      <NuxtPage />
    </div>
    <UserFooter class="z-50" />
  </div>
  <div class="flex w-full min-h-screen bg-zinc-900" v-else>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const noWrapper = !!route.query.noWrapper;

useHead({
  titleTemplate(title) {
    if (title) return `${title} | Drop`;
    return `Drop`;
  },
});
</script>
