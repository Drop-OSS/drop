<template>
  <img ref="emojiEl" class="inline-block emoji" :src="url" :alt="emoji" />
</template>

<script lang="ts" setup>
import twemoji from "@discordapp/twemoji";

const props = defineProps<{
  emoji: string;
}>();

const url = computed(() => {
  return `/twemoji/${twemoji.convert.toCodePoint(props.emoji)}.svg`;
});
</script>
