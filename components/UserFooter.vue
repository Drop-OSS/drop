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
import { IconsDiscordLogo, IconsGithubLogo } from "#components";
const { t } = useI18n();

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
