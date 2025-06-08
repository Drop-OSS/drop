<template>
  <div>
    <Listbox v-model="wiredLocale" as="div">
      <ListboxLabel class="block text-sm/6 font-medium text-zinc-400">{{
        $t("selectLanguage")
      }}</ListboxLabel>
      <div class="relative mt-2">
        <ListboxButton
          class="grid w-full cursor-default grid-cols-1 rounded-md bg-zinc-900 py-1.5 pr-2 pl-3 text-left text-zinc-300 outline-1 -outline-offset-1 outline-zinc-700 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
        >
          <span class="col-start-1 row-start-1 flex items-center gap-3 pr-6">
            <EmojiText
              :emoji="localeToEmoji(wiredLocale)"
              class="-mt-0.5 shrink-0 max-w-6"
            />
            <span class="block truncate">{{
              currentLocaleInformation?.name ?? wiredLocale
            }}</span>
          </span>
          <ChevronUpDownIcon
            class="col-start-1 row-start-1 size-5 self-center justify-self-end text-gray-500 sm:size-4"
            aria-hidden="true"
          />
        </ListboxButton>

        <transition
          leave-active-class="transition ease-in duration-100"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <ListboxOptions
            class="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-hidden sm:text-sm"
          >
            <ListboxOption
              v-for="listLocale in locales"
              :key="listLocale.code"
              v-slot="{ active, selected }"
              as="template"
              :value="listLocale.code"
            >
              <li
                :class="[
                  active
                    ? 'bg-blue-600 text-white outline-hidden'
                    : 'text-zinc-300',
                  'relative cursor-default py-2 pr-9 pl-3 select-none',
                ]"
              >
                <div class="flex items-center">
                  <EmojiText
                    :emoji="localeToEmoji(listLocale.code)"
                    class="-mt-0.5 shrink-0 max-w-6"
                  />
                  <span
                    :class="[
                      selected ? 'font-semibold' : 'font-normal',
                      'ml-3 block truncate',
                    ]"
                    >{{ listLocale.name }}</span
                  >
                </div>

                <span
                  v-if="selected"
                  :class="[
                    active ? 'text-white' : 'text-blue-600',
                    'absolute inset-y-0 right-0 flex items-center pr-4',
                  ]"
                >
                  <CheckIcon class="size-5" aria-hidden="true" />
                </span>
              </li>
            </ListboxOption>
          </ListboxOptions>
        </transition>
      </div>
    </Listbox>
    <NuxtLink
      class="mt-1 transition text-blue-500 hover:text-blue-600 text-sm"
      to="https://translate.droposs.org/projects/drop/"
      target="_blank"
    >
      <i18n-t
        keypath="helpUsTranslate"
        tag="span"
        scope="global"
        class="inline-flex items-center gap-x-1 hover:underline"
      >
        <template #arrow>
          <ArrowTopRightOnSquareIcon class="size-4" />
        </template>
      </i18n-t>
    </NuxtLink>

    <DevOnly
      ><h1 class="mt-3 text-sm text-gray-500">{{ $t("welcome") }}</h1>
    </DevOnly>
  </div>
</template>

<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import { ChevronUpDownIcon } from "@heroicons/vue/16/solid";
import { ArrowTopRightOnSquareIcon } from "@heroicons/vue/24/outline";
import type { Locale } from "vue-i18n";

const { locales, locale: currLocale, setLocale } = useI18n();

function changeLocale(locale: Locale) {
  setLocale(locale);

  // dynamically update the HTML attributes for language and direction
  // this is necessary for proper rendering of the page in the new language
  useHead({
    htmlAttrs: {
      lang: locale,
      dir: locales.value.find((l) => l.code === locale)?.dir || "ltr",
    },
  });
}

function localeToEmoji(local: string): string {
  switch (local) {
    case "en":
    case "en-gb":
    case "en-ca":
    case "en-au":
    case "en-us":
      return "🇺🇸";
    case "en-pirate":
      return "🏴‍☠️";
    case "fr":
      return "🇫🇷";
    case "de":
      return "🇩🇪";
    case "es":
      return "🇪🇸";
    case "it":
      return "🇮🇹";
    case "zh":
      return "🇨🇳";
    case "zh-tw":
      return "🇹🇼";

    default: {
      return "❓";
    }
  }
}

const wiredLocale = computed({
  get() {
    return currLocale.value;
  },
  set(v) {
    changeLocale(v);
  },
});
const currentLocaleInformation = computed(() =>
  locales.value.find((e) => e.code == wiredLocale.value),
);
</script>
