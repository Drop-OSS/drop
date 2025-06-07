<template>
  <footer class="bg-zinc-950" aria-labelledby="footer-heading">
    <h2 id="footer-heading" class="sr-only">{{ $t("footer.footer") }}</h2>
    <div class="mx-auto max-w-7xl px-6 py-16 sm:py-24 lg:px-8">
      <div class="xl:grid xl:grid-cols-3 xl:gap-8">
        <div class="space-y-8">
          <DropWordmark class="h-10" />
          <p class="text-sm leading-6 text-zinc-300">
            {{ $t("drop.desc") }}
          </p>
          <div>
            <Listbox v-model="wiredLocale" as="div">
              <ListboxLabel class="block text-sm/6 font-medium text-zinc-400">{{
                $t("selectLanguage")
              }}</ListboxLabel>
              <div class="relative mt-2">
                <ListboxButton
                  class="grid w-full cursor-default grid-cols-1 rounded-md bg-zinc-900 py-1.5 pr-2 pl-3 text-left text-zinc-300 outline-1 -outline-offset-1 outline-zinc-700 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
                >
                  <span
                    class="col-start-1 row-start-1 flex items-center gap-3 pr-6"
                  >
                    <span alt="" class="-mt-0.5 shrink-0 rounded-full">{{
                      localeToEmoji(wiredLocale)
                    }}</span>
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
                          <span class="-mt-0.5 shrink-0 rounded-full">
                            {{ localeToEmoji(listLocale.code) }}
                          </span>
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
              to="https://translate.droposs.org"
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

          <div class="flex space-x-6">
            <NuxtLink
              v-for="item in navigation.social"
              :key="item.name"
              :to="item.href"
              target="_blank"
              class="text-zinc-400 hover:text-zinc-400"
            >
              <span class="sr-only">{{ item.name }}</span>
              <component :is="item.icon" class="h-6 w-6" aria-hidden="true" />
            </NuxtLink>
          </div>
        </div>
        <div class="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
          <div class="md:grid md:grid-cols-2 md:gap-8">
            <div>
              <h3 class="text-sm font-semibold leading-6 text-white">
                {{ $t("footer.games") }}
              </h3>
              <ul role="list" class="mt-6 space-y-4">
                <li v-for="item in navigation.games" :key="item.name">
                  <NuxtLink
                    :to="item.href"
                    class="text-sm leading-6 text-zinc-300 hover:text-white"
                    >{{ item.name }}</NuxtLink
                  >
                </li>
              </ul>
            </div>
            <div class="mt-10 md:mt-0">
              <h3 class="text-sm font-semibold leading-6 text-white">
                {{ $t("userHeader.links.community") }}
              </h3>
              <ul role="list" class="mt-6 space-y-4">
                <li v-for="item in navigation.community" :key="item.name">
                  <NuxtLink
                    :to="item.href"
                    class="text-sm leading-6 text-zinc-300 hover:text-white"
                    >{{ item.name }}</NuxtLink
                  >
                </li>
              </ul>
            </div>
          </div>
          <div class="md:grid md:grid-cols-2 md:gap-8">
            <div>
              <h3 class="text-sm font-semibold leading-6 text-white">
                {{ $t("footer.documentation") }}
              </h3>
              <ul role="list" class="mt-6 space-y-4">
                <li v-for="item in navigation.documentation" :key="item.name">
                  <NuxtLink
                    :to="item.href"
                    class="text-sm leading-6 text-zinc-300 hover:text-white"
                    >{{ item.name }}</NuxtLink
                  >
                </li>
              </ul>
            </div>
            <div class="mt-10 md:mt-0">
              <h3 class="text-sm font-semibold leading-6 text-white">
                {{ $t("footer.about") }}
              </h3>
              <ul role="list" class="mt-6 space-y-4">
                <li v-for="item in navigation.about" :key="item.name">
                  <NuxtLink
                    :to="item.href"
                    class="text-sm leading-6 text-zinc-300 hover:text-white"
                    >{{ item.name }}</NuxtLink
                  >
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </footer>
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
import { IconsDiscordLogo, IconsGithubLogo } from "#components";
import { ArrowTopRightOnSquareIcon } from "@heroicons/vue/24/outline";

const { t, locales, locale, setLocale } = useI18n();

function localeToEmoji(local: string): string {
  switch (local) {
    case "en":
    case "en-gb":
    case "en-ca":
    case "en-au":
    case "en-us": {
      return "🇺🇸";
    }
    case "en-pirate": {
      return "🏴‍☠️";
    }

    default: {
      return "❓";
    }
  }
}

const wiredLocale = computed({
  get() {
    return locale.value;
  },
  set(v) {
    setLocale(v);
  },
});
const currentLocaleInformation = computed(() =>
  locales.value.find((e) => e.code == wiredLocale.value),
);

const navigation = {
  games: [
    { name: t("store.recentlyAdded"), href: "#" },
    { name: t("store.recentlyReleased"), href: "#" },
    { name: t("footer.topSellers"), href: "#" },
    { name: t("footer.findGame"), href: "#" },
  ],
  community: [
    { name: t("common.friends"), href: "#" },
    { name: t("common.groups"), href: "#" },
    { name: t("common.servers"), href: "#" },
  ],
  documentation: [
    // TODO: public API docs
    // { name: t("footer.api"), href: "https://api.droposs.org/" },
    {
      name: t("footer.docs.server"),
      href: "https://docs.droposs.org/docs/guides/quickstart",
    },
    {
      name: t("footer.docs.client"),
      href: "https://docs.droposs.org/docs/guides/client",
    },
  ],
  about: [
    { name: t("footer.aboutDrop"), href: "https://droposs.org/" },
    { name: t("footer.comparison"), href: "https://droposs.org/comparison" },
  ],
  social: [
    {
      name: t("footer.social.github"),
      href: "https://github.com/Drop-OSS",
      icon: IconsGithubLogo,
    },
    {
      name: t("footer.social.discord"),
      href: "https://discord.gg/NHx46XKJWA",
      icon: IconsDiscordLogo,
    },
  ],
};
</script>
