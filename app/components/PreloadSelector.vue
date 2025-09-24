<template>
  <Combobox
    as="div"
    :value="props.value"
    nullable
    @update:model-value="(v) => emit('update', v)"
  >
    <div class="relative">
      <ComboboxInput
        class="block flex-1 border-0 py-1.5 pl-1 bg-transparent text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6"
        placeholder="file.exe"
        @change="query = $event.target.value"
        @blur="query = ''"
      />
      <ComboboxButton
        v-if="filtered?.length ?? 0 > 0"
        class="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none"
      >
        <ChevronUpDownIcon class="size-5 text-gray-400" aria-hidden="true" />
      </ComboboxButton>

      <ComboboxOptions
        class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-white/5 focus:outline-none sm:text-sm"
      >
        <ComboboxOption
          v-for="guess in filtered"
          :key="guess.filename"
          v-slot="{ active, selected }"
          :value="guess.filename"
          as="template"
        >
          <li
            :class="[
              'relative cursor-default select-none py-2 pl-3 pr-9',
              active ? 'bg-blue-600 text-white outline-none' : 'text-zinc-100',
            ]"
          >
            <span
              :class="[
                'inline-flex items-center gap-x-2 block truncate',
                selected && 'font-semibold',
              ]"
            >
              {{ guess.filename }}
              <IconsPlatform
                :platform="guess.platform.platformIcon.key"
                :fallback="guess.platform.platformIcon.fallback"
                class="size-5 flex-shrink-0 text-blue-600"
              />
            </span>

            <span
              v-if="selected"
              :class="[
                'absolute inset-y-0 right-0 flex items-center pr-4',
                active ? 'text-white' : 'text-blue-600',
              ]"
            >
              <CheckIcon class="size-5" aria-hidden="true" />
            </span>
          </li>
        </ComboboxOption>
        <ComboboxOption
          v-if="query"
          v-slot="{ active, selected }"
          :value="query"
        >
          <li
            :class="[
              'relative cursor-default select-none py-2 pl-3 pr-9',
              active ? 'bg-blue-600 text-white outline-none' : 'text-zinc-100',
            ]"
          >
            <span :class="['block truncate', selected && 'font-semibold']">
              {{ $t("chars.quoted", { text: query }) }}
            </span>

            <span
              v-if="selected"
              :class="[
                'absolute inset-y-0 right-0 flex items-center pr-4',
                active ? 'text-white' : 'text-blue-600',
              ]"
            >
              <CheckIcon class="size-5" aria-hidden="true" />
            </span>
          </li>
        </ComboboxOption>
      </ComboboxOptions>
    </div>
  </Combobox>
</template>

<script setup lang="ts">
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/vue";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/vue/24/outline";

const emit = defineEmits<{
  update: [v: string];
}>();

const props = defineProps<{
  value?: string | undefined;
  guesses?: Array<{ platform: PlatformRenderable; filename: string }>;
}>();

const query = ref("");

const filtered = computed(() =>
  props.guesses?.filter((e) =>
    e.filename.toLowerCase().includes(query.value.toLowerCase()),
  ),
);
</script>
