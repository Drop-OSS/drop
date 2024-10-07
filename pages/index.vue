<template>
  {{ user ?? "no user" }}
</template>

<script setup lang="ts">
useHead({
  title: "Home",
});

const user = useUser();
</script>
