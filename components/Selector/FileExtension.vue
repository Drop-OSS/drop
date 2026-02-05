<template>
  <div>
    <div class="flex gap-1 flex-wrap">
      <span
        v-for="extension in model"
        :key="extension"
        class="inline-flex items-center gap-x-0.5 rounded-md bg-blue-400/10 px-2 py-1 text-xs font-medium text-blue-400 inset-ring inset-ring-blue-400/30"
      >
        {{ extension }}
        <button
          type="button"
          class="group relative -mr-1 size-3.5 rounded-xs hover:bg-blue-500/30"
          @click="() => removeFileExtension(extension)"
        >
          <span class="sr-only">{{ $t("common.remove") }}</span>
          <svg
            viewBox="0 0 14 14"
            class="size-3.5 stroke-blue-400 group-hover:stroke-blue-300"
          >
            <path d="M4 4l6 6m0-6l-6 6" />
          </svg>
          <span class="absolute -inset-1"></span>
        </button>
      </span>
      <span v-if="model.length == 0" class="text-zinc-500 text-xs">{{
        $t("library.admin.fileExtSelector.noSelected")
      }}</span>
    </div>
    <Combobox
      as="div"
      nullable
      :immediate="true"
      :model-value="model"
      class="mt-2 bg-zinc-800 rounded"
      @update:model-value="addFileExtension"
    >
      <div class="relative">
        <ComboboxInput
          class="block flex-1 border-0 py-1.5 pl-2 bg-transparent text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6 w-full"
          placeholder="Start typing..."
          :display-value="(_) => ''"
          @change="query = $event.target.value"
          @blur="query = ''"
        />
        <ComboboxButton
          class="absolute inset-0 right-0 flex items-center justify-end rounded-r-md px-2 focus:outline-none"
        >
          <ChevronUpDownIcon class="size-5 text-gray-400" aria-hidden="true" />
        </ComboboxButton>

        <ComboboxOptions
          class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-white/5 focus:outline-none sm:text-sm"
        >
          <ComboboxOption
            v-if="query"
            v-slot="{ active, selected }"
            :value="query"
            as="template"
          >
            <li
              :class="[
                'relative cursor-default select-none py-2 pl-3 pr-9',
                active
                  ? 'bg-blue-600 text-white outline-none'
                  : 'text-zinc-100',
              ]"
            >
              <span>
                {{
                  $t("library.admin.fileExtSelector.add", [normalize(query)])
                }}</span
              >

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
  </div>
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

const model = defineModel<string[]>({ required: true });

const query = ref("");

function normalize(v: string) {
  const k = v.toLowerCase().replaceAll(/[^a-zA-Z0-9]*/g, "");
  if (k.startsWith(".")) return k;
  return `.${k}`;
}

function addFileExtension(raw: string) {
  const value = normalize(raw);
  if (model.value.includes(value)) return;
  model.value.push(value);
}

function removeFileExtension(extension: string) {
  const index = model.value.findIndex((v) => v === extension);
  if (index == -1) return;
  model.value.splice(index, 1);
}
</script>
