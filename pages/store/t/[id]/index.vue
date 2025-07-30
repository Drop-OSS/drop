<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="w-full overflow-x-hidden">
    <div class="relative overflow-hidden bg-zinc-900">
      <!-- Decorative background image and gradient -->
      <div aria-hidden="true" class="absolute inset-0">
        <div class="absolute inset-0 overflow-hidden">
          <img alt="" class="size-full object-cover" />
        </div>
        <div class="absolute inset-0 bg-zinc-900/75" />
        <div class="absolute inset-0 bg-linear-to-t from-zinc-900" />
      </div>

      <!-- Callout -->
      <section
        aria-labelledby="sale-heading"
        class="relative mx-auto flex max-w-7xl flex-col items-center px-4 pt-32 pb-8 text-center sm:px-6 lg:px-8"
      >
        <div class="mx-auto max-w-2xl lg:max-w-none">
          <h2
            id="sale-heading"
            class="text-4xl font-bold font-display tracking-tight text-zinc-100 sm:text-5xl lg:text-6xl"
          >
            {{ tag.name }}
          </h2>
        </div>
      </section>
    </div>
    <StoreView
      :prefilled="{
        tags: {
          [tag.id]: true,
        } as any,
      }"
    />
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const tagId = route.params.id;

const { tag } = await $dropFetch(`/api/v1/tags/${tagId}`);

useHead({
  title: tag.name,
});
</script>
