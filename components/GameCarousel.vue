<template>
  <div ref="currentComponent">
    <ClientOnly fallback-tag="span">
      <VueCarousel :items-to-show="singlePage" :items-to-scroll="singlePage">
        <VueSlide
          v-for="(game, gameIdx) in games"
          :key="gameIdx"
          class="justify-start"
        >
          <GamePanel
            :game="game"
            :href="game ? `/store/${game.id}` : undefined"
            :show-title-description="showGamePanelTextDecoration"
          />
        </VueSlide>

        <template #addons>
          <VueNavigation />
        </template>
      </VueCarousel>
      <template #fallback>
        <div
          class="flex flex-nowrap flex-row overflow-hidden whitespace-nowrap"
        >
          <SkeletonCard
            v-for="index in 10"
            :key="index"
            :loading="true"
            class="mr-3 flex-none"
          />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { SerializeObject } from "nitropack";

const props = defineProps<{
  items: Array<
    SerializeObject<{
      id: string;
      mName: string;
      mShortDescription: string;
      mCoverObjectId: string;
    }>
  >;
  min?: number;
  width?: number;
}>();

const { showGamePanelTextDecoration } = await $dropFetch(
  `/api/v1/settings`,
);

const currentComponent = ref<HTMLDivElement>();

const min = computed(() => Math.max(props.min ?? 8, props.items.length));
const games = computed(() =>
  Array(min.value)
    .fill(0)
    .map((_, i) => props.items[i]),
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
