<!-- eslint-disable vue/no-v-html -->
<template>
  <component
    :is="platformIcons[props.platform as Platform]"
    v-if="platformIcons[props.platform as Platform]"
  />
  <div v-else-if="props.fallback" v-html="props.fallback" />
  <DropLogo v-else />
</template>

<script setup lang="ts">
import { Platform } from "~/prisma/client/enums";
import type { Component } from "vue";
import LinuxLogo from "./LinuxLogo.vue";
import WindowsLogo from "./WindowsLogo.vue";
import MacLogo from "./MacLogo.vue";
import DropLogo from "../DropLogo.vue";

const props = defineProps<{ platform: string; fallback?: string }>();

const platformIcons: { [key in Platform]: Component } = {
  [Platform.Linux]: LinuxLogo,
  [Platform.Windows]: WindowsLogo,
  [Platform.macOS]: MacLogo,
};
</script>
