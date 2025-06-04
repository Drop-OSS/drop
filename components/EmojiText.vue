<template>
  <img ref="emojiEl" class="inline-block emoji" :src="url" alt="" />
</template>

<script lang="ts" setup>
import twemoji from "@discordapp/twemoji";

const props = defineProps<{
  emoji: string;
}>();

const emojiEl = ref<HTMLElement | null>(null);

const url = computed(() => {
  return `/api/v1/emojis/${twemoji.convert.toCodePoint(props.emoji)}.svg`;
});
</script>
