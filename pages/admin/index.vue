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
      class="mx-auto max-w-md lg:max-w-none md:max-w-none w-full py-2 text-zinc-100"
    >
      <div class="grid grid-cols-6 gap-4">
        <div class="col-span-6 lg:col-span-1 md:col-span-3 row-span-1">
          <TileWithLink>
            <div class="h-full flex">
              <div class="flex-1 my-auto">
                <ApplicationLogo />
              </div>
              <div
                class="flex-6 lg:flex-2 my-auto text-center flex lg:inline mx-4"
              >
                <div class="text-2xl flex-1 font-bold">{{ version }}</div>
                <div class="text-xs flex-1 text-left lg:text-center">
                  {{ t("home.admin.version") }}
                </div>
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
                <div class="text-3xl flex-1 font-bold">{{ gameCount }}</div>
                <div class="text-xs flex-1 text-left lg:text-center">
                  {{ t("home.admin.games") }}
                </div>
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
                <div class="text-3xl flex-1 font-bold">
                  {{ sources.length }}
                </div>
                <div class="text-xs flex-1 text-left lg:text-center">
                  {{ t("home.admin.librarySources") }}
                </div>
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
                <div class="text-3xl flex-1 font-bold">
                  {{ userStats.userCount }}
                </div>
                <div class="text-xs flex-1 text-left lg:text-center">
                  {{ t("home.admin.users") }}
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
            <PieChart :data="pieChartData" />
          </TileWithLink>
        </div>

        <div class="col-span-6 row-span-1 lg:col-span-2 lg:row-span-2">
          <TileWithLink title="System">
            <div class="h-full pb-15 content-center">
              <div class="grid grid-cols-1 text-center gap-4">
                <h3 class="col-span-1 text-lg font-semibold flex">
                  <div class="flex-1 text-left">
                    {{ $t("home.admin.cpuUsage") }}
                  </div>
                  <div class="flex-1 text-sm grow text-right self-center">
                    {{ $t("home.admin.numberCores", systemData.cpuCores) }}
                  </div>
                </h3>
                <div class="col-span-1">
                  <ProgressBar
                    :color="getBarColor(systemData.cpuLoad)"
                    :percentage="systemData.cpuLoad"
                  />
                </div>
                <h3 class="col-span-1 text-lg font-semibold my-2 flex">
                  <div class="flex-none text-left">
                    {{ $t("home.admin.ramUsage") }}
                  </div>
                  <div class="flex-1 text-sm grow text-right self-center">
                    {{
                      $t("home.admin.availableRam", {
                        usedRam: formatBytes(
                          systemData.totalRam - systemData.freeRam,
                        ),
                        totalRam: formatBytes(systemData.totalRam),
                      })
                    }}
                  </div>
                </h3>
                <div class="col-span-1">
                  <ProgressBar
                    :color="
                      getBarColor(
                        getPercentage(
                          systemData.totalRam - systemData.freeRam,
                          systemData.totalRam,
                        ),
                      )
                    "
                    :percentage="
                      getPercentage(
                        systemData.totalRam - systemData.freeRam,
                        systemData.totalRam,
                      )
                    "
                  />
                </div>
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
            <!--            <RankingList :items="biggestGamesLatest.map(gameToRankItem)" />-->
          </TileWithLink>
        </div>
        <div class="col-span-6 lg:col-span-2">
          <TileWithLink
            :title="t('home.admin.biggestGamesOnServer')"
            :subtitle="t('home.admin.allVersionsCombined')"
          >
            <!--            <RankingList :items="biggestGamesCombined.map(gameToRankItem)" />-->
          </TileWithLink>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { formatBytes } from "~/server/internal/utils/files";
import GamepadIcon from "~/components/Icons/GamepadIcon.vue";
import { ServerStackIcon, UserGroupIcon } from "@heroicons/vue/24/outline";
import { getPercentage } from "~/utils/utils";
import { getBarColor } from "~/utils/colors";

definePageMeta({
  layout: "admin",
});

useHead({
  title: "Home",
});

const { t } = useI18n();

const systemData = useSystemData();

const { version, gameCount, sources, userStats } =
  await $dropFetch("/api/v1/admin/home");

const pieChartData = [
  {
    label: t("home.admin.inactiveUsers"),
    value: userStats.userCount - userStats.activeSessions,
  },
  { label: t("home.admin.activeUsers"), value: userStats.activeSessions },
];
</script>
