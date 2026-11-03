<template>
  <div class="space-y-8">
    <div class="flex flex-row items-center justify-between">
      <div>
        <h3 class="text-sm font-medium leading-6 text-ink-100">
          Enable update checks
        </h3>
        <p class="mt-1 text-sm leading-6 text-ink-400">
          Drop will automatically check for updates from your server
        </p>
      </div>
      <Switch
        v-model="model.enableUpdates"
        :class="[
          model.enableUpdates ? 'bg-accent-600' : 'bg-surface-700',
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
        ]"
      >
        <span
          :class="[
            model.enableUpdates ? 'translate-x-5' : 'translate-x-0',
            'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          ]"
        />
      </Switch>
    </div>

  </div>
</template>

<script setup lang="ts">
import { Switch } from "@headlessui/vue";
import type { GameVersion } from '~/types';

const model = defineModel<GameVersion["userConfiguration"]>({ required: true });
</script>
