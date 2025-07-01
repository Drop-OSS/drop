<template>
  <NuxtLink
    v-if="game || noGamesDefaultsToPlaceholder"
    :href="href"
    :class="{
      'transition-all duration-300 text-left hover:scale-[1.02] hover:shadow-lg hover:-translate-y-0.5':
        animate,
    }"
    class="group relative w-48 h-64 rounded-lg overflow-hidden"
    @click="setActiveGame"
  >
    <div
      :class="{
        'transition-all duration-300 group-hover:scale-110': animate,
      }"
      class="absolute inset-0"
    >
      <img
        :src="imageProps.src"
        class="w-full h-full object-cover brightness-[90%]"
        :class="imageProps.class"
        :alt="imageProps.alt"
      />
      <div
        class="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-zinc-950/20 to-transparent"
      />
    </div>

    <div
      v-if="showTitleDescription"
      class="absolute bottom-0 left-0 w-full p-3"
    >
      <h1
        :class="{ 'group-hover:text-white transition-colors': animate }"
        class="text-zinc-100 text-sm font-bold font-display"
      >
        {{ game ? game.mName : $t("settings.store.dropGameNamePlaceholder") }}
      </h1>
      <p
        :class="{
          'group-hover:text-zinc-300 transition-colors': animate,
        }"
        class="text-zinc-400 text-xs line-clamp-2"
      >
        {{
          game
            ? game.mShortDescription
            : $t("settings.store.dropGameDescriptionPlaceholder")
        }}
      </p>
    </div>
  </NuxtLink>
  <SkeletonCard
    v-else-if="noGamesDefaultsToPlaceholder === false"
    :message="$t('store.noGame')"
  />
</template>

<script setup lang="ts">
import type { SerializeObject } from "nitropack";

const { t } = useI18n();
const {
  game,
  href = undefined,
  showTitleDescription = true,
  animate = true,
  noGamesDefaultsToPlaceholder = false,
} = defineProps<{
  game:
    | SerializeObject<{
        id: string;
        mCoverObjectId: string;
        mName: string;
        mShortDescription: string;
      }>
    | undefined
    | null;
  href?: string;
  showTitleDescription?: boolean;
  animate?: boolean;
  noGamesDefaultsToPlaceholder?: boolean;
}>();

const active = useState<string | undefined>();
const setActiveGame = (gameId?: string) => {
  if (game) {
    active.value = gameId;
  }
};

const imageProps = {
  src: "",
  class: { active: false },
  alt: t("settings.store.dropGameAltPlaceholder"),
};
if (game) {
  imageProps.src = useObject(game.mCoverObjectId);
  imageProps.alt = game.mName;
  imageProps.class = { active: active.value === game.id };
} else if (noGamesDefaultsToPlaceholder) {
  imageProps.src = "/game-panel-placeholder.png";
}
</script>

<style scoped>
img.active {
  view-transition-name: selected-game;
  contain: layout;
}
</style>
