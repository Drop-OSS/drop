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
      class="mx-auto max-w-md lg:max-w-none w-full px-6 py-2 lg:px-8 text-zinc-100"
    >
      <div class="grid grid-cols-6 gap-4">
        <div class="col-span-6">
          <div class="grid grid-flow-col grid-rows-2 grid-cols-6 gap-4">
            <div class="row-span-1 col-span-1">
              <TileWithLink>
                <div class="h-full flex">
                  <div class="flex-1 my-auto">
                    <DropLogo />
                  </div>
                  <div class="flex-auto my-auto text-center">
                    <div>{{ t("home.admin.version") }}</div>
                    <div class="font-bold">{{ version }}</div>
                  </div>
                </div>
              </TileWithLink>
            </div>

            <div class="row-span-1 col-span-1">
              <TileWithLink>
                <div class="h-full flex">
                  <div class="flex-1 my-auto">
                    <GamepadIcon />
                  </div>
                  <div class="flex-auto my-auto text-center">
                    <div>{{ t("home.admin.games") }}</div>
                    <div class="font-bold">{{ gameCount }}</div>
                  </div>
                </div>
              </TileWithLink>
            </div>

            <div class="row-span-1 col-span-1">
              <TileWithLink>
                <div class="h-full flex">
                  <div class="flex-1 my-auto">
                    <ServerStackIcon />
                  </div>
                  <div class="flex-auto my-auto text-center">
                    <div>{{ t("home.admin.librarySources") }}</div>
                    <div class="font-bold">{{ sources.length }}</div>
                  </div>
                </div>
              </TileWithLink>
            </div>

            <div class="row-span-1 col-span-1">
              <TileWithLink>
                <div class="h-full flex">
                  <div class="flex-1 my-auto">
                    <UserGroupIcon />
                  </div>
                  <div class="flex-auto my-auto text-center">
                    <div>{{ t("home.admin.users") }}</div>
                    <div class="font-bold">{{ userStats.userCount }}</div>
                  </div>
                </div>
              </TileWithLink>
            </div>

            <div class="col-span-2 row-span-2">
              <TileWithLink
                :link="{
                  url: '/admin/users',
                  label: t('home.admin.goToUsers'),
                }"
              >
                <div class="text-center">
                  <div class="py-2">
                    <PieChart
                      :data="pieChartData"
                      :title="t('home.admin.activeInactiveUsers')"
                    />
                  </div>
                  <ul>
                    <li v-for="slice in pieChartData" :key="slice.value">
                      {{
                        t("common.labelValueColon", {
                          label: slice.label,
                          value: slice.value,
                        })
                      }}
                    </li>
                  </ul>
                </div>
              </TileWithLink>
            </div>
          </div>
        </div>
        <div class="col-span-6">
          <TileWithLink
            title="Library"
            :link="{ url: '/admin/library', label: 'Go to library' }"
          >
            <SourceTable :sources="sources" />
          </TileWithLink>
        </div>
        <div class="col-span-2">
          <TileWithLink
            :title="t('home.admin.biggestGamesToDownload')"
            :subtitle="t('home.admin.latestVersionOnly')"
          >
            <RankingList :items="biggestGamesLatest.map(gameToRankItem)" />
          </TileWithLink>
        </div>
        <div class="col-span-2">
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
