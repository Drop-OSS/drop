<template>
  <div v-if="!noWrapper" class="flex flex-col w-full min-h-screen bg-zinc-900">
    <UserHeader class="z-50" hydrate-on-idle />
    <div class="grow flex">
      <NuxtPage />
    </div>
    <UserFooter class="z-50" hydrate-on-interaction />
  </div>
  <div v-else class="flex w-full min-h-screen bg-zinc-900">
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const noWrapper = !!route.query.noWrapper;

useHead({
  htmlAttrs: {
    lang: "en",
  },
  link: [],
  titleTemplate(title) {
    if (title) return `${title} | Drop`;
    return `Drop`;
  },
});
</script>
