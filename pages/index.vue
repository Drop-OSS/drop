<template>
  <div></div>
</template>

<script setup lang="ts">
useHead({
  title: "Home",
});

const router = useRouter();
router.push("/store");
</script>
