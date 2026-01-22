<template>
  <li class="p-3 bg-zinc-800 ring-1 ring-zinc-700 shadow rounded-lg space-y-2">
    <div class="flex justify-between">
      <h1
        v-if="!isSetup(props.config)"
        class="font-semibold text-zinc-300 text-md"
      >
        {{ props.config.name }}
      </h1>
      <span class="flex items-center">
        <component
          :is="PLATFORM_ICONS[props.config.platform]"
          alt=""
          class="size-5 flex-shrink-0 text-blue-600"
        />
        <span class="ml-2 block truncate text-zinc-100 text-sm font-bold">{{
          props.config.platform
        }}</span>
      </span>
    </div>
    <div
      class="inline-flex gap-x-1 items-center bg-zinc-950 text-zinc-400 mono rounded-md p-2"
    >
      <p>{{ props.config.command }}</p>
    </div>
    <ExecutorWidget
      v-if="!isSetup(props.config) && props.config.executor"
      :executor="{
        launchId: props.config.launchId,
        gameName: props.config.executor.gameVersion.game.mName,
        gameIcon: props.config.executor.gameVersion.game.mIconObjectId,
        versionName: (props.config.executor.gameVersion.displayName ??
          props.config.executor.gameVersion.versionPath)!,
        launchName: props.config.executor.name,
        platform: props.config.executor.platform,
      }"
    />
  </li>
</template>

<script setup lang="ts">
import type { AdminFetchGameType } from "~/server/api/v1/admin/game/[id]/index.get";

const props = defineProps<{
  config:
    | AdminFetchGameType["versions"][number]["setups"][number]
    | AdminFetchGameType["versions"][number]["launches"][number];
}>();

function isSetup(
  v: typeof props.config,
): v is AdminFetchGameType["versions"][number]["setups"][number] {
  return Object.prototype.hasOwnProperty.call(v, "setupId");
}
</script>
