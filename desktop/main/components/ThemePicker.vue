<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium leading-6 text-ink-100">Accent</h3>
      <p class="mt-1 text-sm leading-6 text-ink-400">
        Buttons, links and highlights follow the accent.
      </p>
      <div class="mt-3 flex flex-row gap-3">
        <button
          v-for="key in ACCENT_KEYS"
          :key="key"
          type="button"
          :aria-label="key"
          :aria-pressed="theme.accent === key"
          :disabled="busy"
          :style="{ backgroundColor: swatch.accent(key) }"
          :class="[
            theme.accent === key
              ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-900'
              : 'hover:opacity-80',
            'h-8 w-8 rounded-full transition disabled:opacity-40',
          ]"
          @click="pick('accent', key)"
        />
      </div>
    </div>

    <div>
      <h3 class="text-sm font-medium leading-6 text-ink-100">Surface tint</h3>
      <p class="mt-1 text-sm leading-6 text-ink-400">
        The tint of backgrounds, panels and text.
      </p>
      <div class="mt-3 flex flex-row gap-4">
        <div
          v-for="key in SURFACE_KEYS"
          :key="key"
          class="flex flex-col items-center gap-1.5"
        >
          <button
            type="button"
            :aria-label="key"
            :aria-pressed="theme.surface === key"
            :disabled="busy"
            :style="{ backgroundColor: swatch.surface(key) }"
            :class="[
              theme.surface === key
                ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-900'
                : 'border border-surface-600 hover:opacity-80',
              'h-8 w-8 rounded-full transition disabled:opacity-40',
            ]"
            @click="pick('surface', key)"
          />
          <span class="text-xs capitalize text-ink-500">{{ key }}</span>
        </div>
      </div>
    </div>

    <div v-if="error" class="rounded-md bg-red-600/10 p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <XCircleIcon class="h-5 w-5 text-red-600" aria-hidden="true" />
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-600">{{ error }}</h3>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XCircleIcon } from "@heroicons/vue/16/solid";

const { theme, set } = useTheme();

const busy = ref(false);
const error = ref<string | null>(null);

async function pick(axis: "accent" | "surface", key: string) {
  if (busy.value || theme.value[axis] === key) return;
  busy.value = true;
  error.value = null;
  try {
    // Applies instantly; the choice persists on failure too (harmless -
    // a retry or restart falls back to defaults).
    await set(axis, key);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}
</script>
