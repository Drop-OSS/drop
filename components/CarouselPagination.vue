<template>
  <div class="flex flex-row flex-wrap gap-2 justify-center">
    <button
      v-for="(_, i) in amount"
      :key="i"
      :class="[
        carousel.currentSlide == i ? 'bg-blue-600 w-6' : 'bg-zinc-700 w-3',
        'transition-all cursor-pointer h-2 rounded-full',
      ]"
    />
  </div>
</template>

<script setup lang="ts">
import { injectCarousel } from "vue3-carousel";

const carousel = inject(injectCarousel)!;

const amount = carousel.maxSlide - carousel.minSlide + 1;

// function slideTo(index: number) {
//   const offsetIndex = index + carousel.minSlide;
//   carousel.nav.slideTo(offsetIndex);
// }
</script>
