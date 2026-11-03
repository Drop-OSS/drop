<template>
  <InitiateAuthModule>
    <h1
      class="mt-4 text-3xl font-bold font-display tracking-tight text-ink-100 sm:text-5xl"
    >
      You've been signed out
    </h1>
    <p class="mt-6 text-base leading-7 text-ink-400">
      Unfortunately, you've been signed out. To sign back in, click below.
    </p>
  </InitiateAuthModule>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "mini",
});
</script>
