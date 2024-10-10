<template>
  <content class="flex flex-col w-full min-h-screen bg-zinc-900">
    <UserHeader />
    <div class="grow flex">
      <NuxtPage />
      {{ test }}
    </div>
    <UserFooter />
  </content>
</template>

<script setup lang="ts">
useHead({
  titleTemplate(title) {
    if (title) return `${title} | Drop`;
    return `Drop`;
  },
});

const test = useTask("test");
</script>
