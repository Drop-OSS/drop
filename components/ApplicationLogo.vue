<template>
  <template v-if="!mLogoObjectId">
    <DropLogo />
  </template>
  <template v-else>
    <img :src="useObject(mLogoObjectId)" :alt="`${serverName} logo`" />
  </template>
</template>

<script setup lang="ts">
const { serverName, mLogoObjectId } = await $dropFetch("/api/v1");
</script>
