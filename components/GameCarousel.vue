<template>
  <div ref="currentComponent">
    <ClientOnly fallback-tag="span">
      <VueCarousel :itemsToShow="singlePage" :itemsToScroll="singlePage">
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
      <template #fallback>
        <!-- this will be rendered on server side -->
        <div class="min-h-55">
          <div class="flex items-center justify-center p-4">
            <div
              class="flex items-center space-x-2 animate-pulse rounded-xl shadow-lg p-6"
            >
              <div class="w-4 h-4 bg-gray-400 rounded-full"></div>
              <div class="w-4 h-4 bg-gray-400 rounded-full"></div>
              <div class="w-4 h-4 bg-gray-400 rounded-full"></div>
              <span class="ml-4 text-gray-200 font-medium">Loading...</span>
            </div>
          </div>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { Game } from "@prisma/client";
import type { SerializeObject } from "nitropack";

const props = defineProps<{
  items: Array<SerializeObject<Game>>;
  min?: number;
  width?: number;
}>();

const currentComponent = ref<HTMLDivElement>();

const min = computed(() => Math.max(props.min ?? 8, props.items.length));
const games: Ref<Array<SerializeObject<Game> | undefined>> = computed(() =>
  Array(min.value)
    .fill(0)
    .map((_, i) => props.items[i])
);

const singlePage = ref(2);
const sizeOfCard = 192 + 10;

const handleResize = () => {
  singlePage.value =
    (props.width ??
      currentComponent.value?.parentElement?.clientWidth ??
      window.innerWidth) / sizeOfCard;
};

onMounted(() => {
  handleResize();
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
});
</script>
