<template>
  <img
    v-if="profile.avatarObjectId"
    :src="useObject(profile.avatarObjectId)"
    class="h-full w-full rounded-sm object-cover"
    alt=""
  />
  <!-- Pre-avatar profiles (created before this existed): the player's initial
       on their colour stands in until the colour is next touched. -->
  <span
    v-else
    class="flex h-full w-full items-center justify-center rounded-sm bg-cover text-[0.6rem] font-bold text-white"
    :style="{
      backgroundColor: PLAYER_COLORS[profile.color] ?? PLAYER_COLORS.blue,
    }"
  >
    {{ profile.name.slice(0, 1).toUpperCase() }}
  </span>
</template>

<script setup lang="ts">
import type { Profile } from "~/composables/profiles";

defineProps<{ profile: Profile }>();
</script>
