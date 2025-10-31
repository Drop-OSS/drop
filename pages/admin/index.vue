<template>
  <div class="space-y-4">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-zinc-100">
          {{ t("home.admin.title") }}
        </h1>
        <p class="mt-2 text-base text-zinc-400">
          {{ t("home.admin.subheader") }}
        </p>
      </div>
    </div>
    <main
      class="mx-auto max-w-md lg:max-w-none md:max-w-none w-full px-6 py-2 lg:px-8 text-zinc-100"
    >
      <div class="grid grid-cols-6 gap-4">
        <div class="col-span-6 lg:col-span-1 md:col-span-3 row-span-1">
          <TileWithLink>
            <div class="h-full flex">
              <div class="flex-1 my-auto">
                <DropLogo />
              </div>
              <div
                class="flex-6 lg:flex-2 my-auto text-center flex lg:inline mx-4"
              >
                <div class="flex-1 text-left lg:text-center">
                  {{ t("home.admin.version") }}
                </div>
                <div class="flex-1 font-bold">{{ version }}</div>
              </div>
            </div>
          </TileWithLink>
        </div>

        <div class="col-span-6 lg:col-span-1 md:col-span-3">
          <TileWithLink>
            <div class="h-full flex">
              <div class="flex-1 my-auto">
                <GamepadIcon />
              </div>
              <div
                class="flex-6 lg:flex-2 my-auto text-center flex lg:inline mx-4"
              >
                <div class="flex-1 text-left lg:text-center">
                  {{ t("home.admin.games") }}
                </div>
                <div class="flex-1 font-bold">{{ gameCount }}</div>
              </div>
            </div>
          </TileWithLink>
        </div>

        <div
          class="col-span-6 lg:col-span-1 md:col-span-3 row-span-1 lg:col-start-1 lg:row-start-2"
        >
          <TileWithLink>
            <div class="h-full flex">
              <div class="flex-1 my-auto">
                <ServerStackIcon />
              </div>
              <div
                class="flex-6 lg:flex-2 my-auto text-center flex lg:inline mx-4"
              >
                <div class="flex-1 text-left lg:text-center">
                  {{ t("home.admin.librarySources") }}
                </div>
                <div class="flex-1 font-bold">{{ sources.length }}</div>
              </div>
            </div>
          </TileWithLink>
        </div>

        <div
          class="col-span-6 lg:col-span-1 md:col-span-3 row-span-1 lg:col-start-2 lg:row-start-2"
        >
          <TileWithLink>
            <div class="h-full flex">
              <div class="flex-1 my-auto">
                <UserGroupIcon />
              </div>
              <div
                class="flex-6 lg:flex-2 my-auto text-center flex lg:inline mx-4"
              >
                <div class="flex-1 text-left lg:text-center">
                  {{ t("home.admin.users") }}
                </div>
                <div class="flex-1 font-bold">
                  {{ userStats.userCount }}
                </div>
              </div>
            </div>
          </TileWithLink>
        </div>

        <div class="col-span-6 row-span-1 lg:col-span-2 lg:row-span-2">
          <TileWithLink
            :link="{
              url: '/admin/users',
              label: t('home.admin.goToUsers'),
            }"
            :title="t('home.admin.activeInactiveUsers')"
          >
            <div class="text-center flex lg:block">
              <div class="flex-1 py-2">
                <PieChart :data="pieChartData" />
              </div>
            </div>
          </TileWithLink>
        </div>
        <div class="col-span-6">
          <TileWithLink
            title="Library"
            :link="{ url: '/admin/library', label: 'Go to library' }"
          >
            <SourceTable :sources="sources" />
          </TileWithLink>
        </div>
        <div class="col-span-6 lg:col-span-2">
          <TileWithLink
            :title="t('home.admin.biggestGamesToDownload')"
            :subtitle="t('home.admin.latestVersionOnly')"
          >
            <RankingList :items="biggestGamesLatest.map(gameToRankItem)" />
          </TileWithLink>
        </div>
        <div class="col-span-6 lg:col-span-2">
          <TileWithLink
            :title="t('home.admin.biggestGamesOnServer')"
            :subtitle="t('home.admin.allVersionsCombined')"
          >
            <RankingList :items="biggestGamesAll.map(gameToRankItem)" />
          </TileWithLink>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { formatBytes } from "~/server/internal/utils/files";
import GamepadIcon from "~/components/Icons/GamepadIcon.vue";
import DropLogo from "~/components/DropLogo.vue";
import { ServerStackIcon, UserGroupIcon } from "@heroicons/vue/24/outline";
import type { GameWithSize } from "~/server/internal/library";
import type { RankItem } from "~/components/RankingList.vue";

definePageMeta({
  layout: "admin",
});

useHead({
  title: "Home",
});

const { t } = useI18n();

const {
  version,
  gameCount,
  sources,
  userStats,
  biggestGamesLatest,
  biggestGamesAll,
} = await $dropFetch("/api/v1/admin/home");

const gameToRankItem = (game: GameWithSize, rank: number): RankItem => ({
  rank: rank + 1,
  name: game.mName,
  value: formatBytes(game.size),
});

const pieChartData = [
  {
    label: t("home.admin.inactiveUsers"),
    value: userStats.userCount - userStats.activeSessions,
  },
  { label: t("home.admin.activeUsers"), value: userStats.activeSessions },
];
</script>
