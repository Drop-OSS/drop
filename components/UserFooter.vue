<template>
  <footer class="bg-zinc-950" aria-labelledby="footer-heading">
    <h2 id="footer-heading" class="sr-only">Footer</h2>
    <div class="mx-auto max-w-7xl px-6 py-16 sm:py-24 lg:px-8">
      <div class="xl:grid xl:grid-cols-3 xl:gap-8">
        <div class="space-y-8">
          <Wordmark class="h-10" />
          <p class="text-sm leading-6 text-zinc-300">
            An open-source game distribution platform built for speed,
            flexibility and beauty.
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
              <h3 class="text-sm font-semibold leading-6 text-white">Games</h3>
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
                Community
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
                Documentation
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
              <h3 class="text-sm font-semibold leading-6 text-white">About</h3>
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

const navigation = {
  games: [
    { name: "Newly Added", href: "#" },
    { name: "New Releases", href: "#" },
    { name: "Top Sellers", href: "#" },
    { name: "Find a Game", href: "#" },
  ],
  community: [
    { name: "Friends", href: "#" },
    { name: "Groups", href: "#" },
    { name: "Servers", href: "#" },
  ],
  documentation: [
    { name: "API", href: "https://api.droposs.org/" },
    {
      name: "Server Docs",
      href: "https://wiki.droposs.org/guides/quickstart.html",
    },
    {
      name: "Client Docs",
      href: "https://wiki.droposs.org/guides/client.html",
    },
  ],
  about: [
    { name: "About Drop", href: "https://droposs.org/" },
    { name: "Features", href: "https://droposs.org/features" },
    { name: "FAQ", href: "https://droposs.org/faq" },
  ],
  social: [
    {
      name: "GitHub",
      href: "https://github.com/Drop-OSS",
      icon: IconsGithubLogo,
    },
    {
      name: "Discord",
      href: "https://discord.gg/NHx46XKJWA",
      icon: IconsDiscordLogo,
    },
  ],
};
</script>
