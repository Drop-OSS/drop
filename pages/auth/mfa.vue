<template>
  <main class="mx-auto w-full max-w-7xl px-6 pt-10 pb-16 sm:pb-24 lg:px-8">
    <DropLogo class="mx-auto h-10 w-auto sm:h-12" />
    <div class="mx-auto mt-20 max-w-md text-center sm:mt-24">
      <h1
        class="mt-4 text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl"
      >
        Two-factor authentication
      </h1>
      <p class="mt-6 text-sm font-medium text-pretty text-zinc-400 sm:text-md">
        Two-factor authentication is enabled on your account. Choose one of the
        options below to continue.
      </p>
    </div>
    <div class="mx-auto mt-16 flow-root max-w-lg sm:mt-20">
      <NuxtPage />
      <div v-if="route.path !== '/auth/mfa'" class="mt-10 flex justify-center">
        <NuxtLink
          :href="{ path: '/auth/mfa', query: route.query }"
          class="text-sm/6 font-semibold text-blue-400"
          ><span aria-hidden="true">&larr;</span> Back to options</NuxtLink
        >
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
const route = useRoute();

definePageMeta({
  layout: false,
});

useHead({
  titleTemplate(title) {
    return title ? `${title} - Drop` : "Two-factor authentication - Drop";
  },
});
</script>
