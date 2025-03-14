<template>
  <VueCarousel :itemsToShow="moveAmount" :itemsToScroll="moveAmount / 2">
    <VueSlide
      class="justify-start"
      v-for="(game, gameIdx) in games"
      :key="gameIdx"
    >
      <GamePanel :game="game" />
    </VueSlide>

    <template #addons>
      <VueNavigation />
    </template>
  </VueCarousel>
</template>

<script setup lang="ts">
import type { Game } from "@prisma/client";
import type { SerializeObject } from "nitropack";

const props = defineProps<{
  items: Array<SerializeObject<Game>>;
  min?: number;
}>();

const min = computed(() => Math.max(props.min ?? 8, props.items.length));
const games: Ref<Array<SerializeObject<Game> | undefined>> = computed(() =>
  Array(min.value)
    .fill(0)
    .map((_, i) => props.items[i])
);

const moveAmount = ref(1);
const moveFactor = 1.8 / 400;

onMounted(() => {
  moveAmount.value = moveFactor * window.innerWidth;
});
</script>
