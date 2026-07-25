<template>
  <iframe :src="convertedStoreUrl" title="Store" class="grow w-full h-full" />
</template>
<script setup lang="ts">
import { convertFileSrc } from "@tauri-apps/api/core";

const route = useRoute();

const gameId = route.query.gameId?.toString();

// This is necessary because convertFileSrc encodes the URI
const convertedStoreUrl = convertFileSrc(`dummyvalue`, "server").replace(
  "dummyvalue",
  gameId ? `store/${gameId}` : "store",
);
</script>
