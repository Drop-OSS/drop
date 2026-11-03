<template>
  <div class="border-b border-surface-700 py-5">
    <h3 class="text-base font-semibold font-display leading-6 text-ink-100">
      General
    </h3>
  </div>

  <div class="mt-5 space-y-8">
    <div class="flex flex-row items-center justify-between">
      <div>
        <h3 class="text-sm font-medium leading-6 text-ink-100">
          Start with system
        </h3>
        <p class="mt-1 text-sm leading-6 text-ink-400">
          Drop will automatically start when you log into your computer
        </p>
      </div>
      <Switch
        v-model="autostartEnabled"
        :class="[
          autostartEnabled ? 'bg-accent-600' : 'bg-surface-700',
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
        ]"
      >
        <span
          :class="[
            autostartEnabled ? 'translate-x-5' : 'translate-x-0',
            'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          ]"
        />
      </Switch>
    </div>

    <div>
      <h3 class="text-sm font-medium leading-6 text-ink-100">Colours</h3>
      <p class="mt-1 text-sm leading-6 text-ink-400">
        Pick the look of the whole app; it applies as you choose.
      </p>
      <div class="mt-3">
        <ThemePicker />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Switch } from "@headlessui/vue";
import { invoke } from "@tauri-apps/api/core";

defineProps<{}>();

const autostartEnabled = ref<boolean>(false);

// Load initial state
invoke("get_autostart_enabled").then((enabled) => {
  autostartEnabled.value = enabled as boolean;
});

// Watch for changes and update autostart
watch(autostartEnabled, async (newValue: boolean) => {
  try {
    await invoke("toggle_autostart", { enabled: newValue });
  } catch (error) {
    console.error("Failed to toggle autostart:", error);
    // Revert the toggle if it failed
    autostartEnabled.value = !newValue;
  }
});
</script>
