<template>
  <div class="space-y-4">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-zinc-100">
          {{ $t("home.admin.title") }}
        </h1>
        <p class="mt-2 text-base text-zinc-400">
          {{ $t("home.admin.subheader") }}
        </p>
      </div>
    </div>
    <main
      class="mx-auto max-w-md lg:max-w-none w-full px-6 py-2 lg:px-8 text-zinc-100"
    >
      <div class="grid grid-cols-3 gap-4">
        <div class="col-span-1">
          <TileWithLink title="Drop version" :right-title="version" />
        </div>
        <div class="col-span-1">
          <TileWithLink
            title="Users"
            :link="{ url: '/admin/users', label: 'Go to users' }"
            :right-title="
              $t('library.admin.sources.totalUserCount', {
                userCount: userStats.userCount,
              })
            "
          >
            <div class="text-center">
              <div>
                <PieChart :data="pieChartData" title="Active/inactive users" />
              </div>
              <ul class="my-4">
                <li v-for="slice in pieChartData" :key="slice.value">
                  {{
                    $t("common.labelValueColon", {
                      label: slice.label,
                      value: slice.value,
                    })
                  }}
                </li>
              </ul>
            </div>
          </TileWithLink>
        </div>
        <div class="col-span-3">
          <TileWithLink
            title="Library"
            :link="{ url: '/admin/library', label: 'Go to library' }"
            :right-title="
              $t('library.admin.sources.totalGameCount', {
                gameCount: gameCount,
              })
            "
          >
            <SourceTable :sources="sources" />
          </TileWithLink>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "admin",
});

useHead({
  title: "Home",
});

const { version, gameCount, sources, userStats } =
  await $dropFetch("/api/v1/admin/home");

const pieChartData = [
  {
    label: "Inactive users",
    value: userStats.userCount - userStats.activeSessions,
  },
  { label: "Active users", value: userStats.activeSessions },
];
</script>
