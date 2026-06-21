<template>
  <div>
    <label for="launch" class="block text-sm/6 font-medium text-zinc-100"
      >Launch string template</label
    >
    <div class="mt-2">
      <input
        type="text"
        name="launch"
        id="launch"
        class="block w-full rounded-md bg-zinc-800 px-3 py-1.5 text-base text-zinc-100 outline-1 -outline-offset-1 outline-zinc-800 placeholder:text-zinc-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
        placeholder="{}"
        aria-describedby="launch-description"
        v-model="model.launchTemplate"
      />
    </div>
    <p class="mt-2 text-sm text-zinc-400" id="launch-description">
      Override the launch string. Passed to system's default shell, and replaces
      "{}" with the command to start the game.
      <span class="font-semibold text-zinc-200"
        >Leaving it blank will cause the game not to start.</span
      >
    </p>

    <ProtonSelector v-model="model" v-if="$props.protonEnabled" />
    <HandlerSelector v-model="model" :game-id="$props.gameId" />
  </div>
</template>

<script setup lang="ts">
import type { GameVersion } from "~/types";
import ProtonSelector from "./ProtonSelector.vue";
import HandlerSelector from "./HandlerSelector.vue";

const model = defineModel<GameVersion["userConfiguration"]>({ required: true });

const props = defineProps<{
  protonEnabled: boolean;
  gameId: string;
}>();
</script>
