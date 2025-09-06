<template>
  <div>{{ model }}</div>
</template>

<script setup lang="ts">
import type { SerializeObject } from "nitropack";
import type { RedistModel, UserPlatformModel } from "~/prisma/client/models";

type ModelType = SerializeObject<
  RedistModel & { platform?: UserPlatformModel }
>;

const model = defineModel<ModelType>({ required: true });
</script>
