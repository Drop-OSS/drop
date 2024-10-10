<template>
  {{ games }}
</template>

<script setup lang="ts">
useHead({
  title: "Home",
});

const games = await $fetch("/api/v1/games/front");
</script>
