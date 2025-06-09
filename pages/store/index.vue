<template>
  <div class="w-full flex flex-col overflow-x-hidden">
    <!-- Hero section -->
    <StoreBigCarousel :source="{ name: 'newlyAdded' }" title="Newly added" />

    <StoreSmallBento :source="{ name: 'companies' }" title="Find by company" />
    <StoreSmallCarousel
      :source="{ name: 'newlyReleased' }"
      title="Newly released"
    />
    <StoreSmallFocused :source="{ name: 'featured' }" title="Featured" />
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();

useHead({
  title: t("store.title"),
});
</script>
