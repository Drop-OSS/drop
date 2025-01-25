<template>
  <div class="flex flex-row flex-wrap gap-2 justify-center">
    <button
      v-for="(_, i) in amount"
      @click="() => slideTo(i)"
      :class="[
        currentSlide == i ? 'bg-blue-600 w-6' : 'bg-zinc-700 w-3',
        'transition-all cursor-pointer h-2 rounded-full',
      ]"
    />
  </div>
</template>

<script setup lang="ts">
const maxSlide = inject("maxSlide", ref(1));
const minSlide = inject("minSlide", ref(1));
const currentSlide = inject("currentSlide", ref(1));
const nav: { slideTo?: (index: number) => any } = inject("nav", {});

const amount = computed(() => maxSlide.value - minSlide.value + 1);

function slideTo(index: number) {
  if (!nav.slideTo) return console.warn(`error moving slide: nav not defined`);
  const offsetIndex = index + minSlide.value;
  nav.slideTo(offsetIndex);
}
</script>
