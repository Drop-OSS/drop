<template>
  <div
    class="mx-auto flex flex-col items-center gap-y-4 max-w-2xl py-32 sm:py-48 lg:py-56"
  >
    <div>
      <Wordmark />
    </div>
    <div class="text-center">
      <h1
        class="text-balance text-4xl font-bold font-display tracking-tight text-ink-100 sm:text-6xl"
      >
        Let's get you set up
      </h1>
      <p class="mt-6 text-lg leading-8 text-ink-400">
        You'll need to have set up a Drop instance and created an account on it. If you're connecting to another person's instance, you'll need the url and an account.
      </p>
      <div class="mt-10 flex items-center justify-center gap-x-6">
        <NuxtLink
          href="/setup/server"
          class="rounded-md bg-accent-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
          >Get started -></NuxtLink
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "mini",
});
</script>
