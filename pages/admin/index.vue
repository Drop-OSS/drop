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
          <TileWithLink title="Drop version">
            <p>
              {{ version }}
            </p>
          </TileWithLink>
        </div>
        <div class="col-span-1">
          <TileWithLink
            title="Users"
            :link="{ url: '/admin/users', label: 'Go to users' }"
          >
            <div>
              <PieChart :data="data" title="Active/inactive users" />
            </div>
            <ul class="my-4">
              <li v-for="slice in data" :key="slice.value">
                {{ slice.label }}: {{ slice.value }}
              </li>
            </ul>
          </TileWithLink>
        </div>
        <div class="col-span-3">
          <TileWithLink
            title="Library"
            :link="{ url: '/admin/library', label: 'Go to library' }"
          >
            <h2>Game count: {{ gameCount }}</h2>
            <h2>Sources</h2>
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

// const { userCount, version, activeUserCount, gameCount } =
const { version, gameCount, sources } = await $dropFetch("/api/v1/admin/home");
// const sources = [
//   {
//     name: "FS1",
//     fsTotal: 988995506176,
//     fsAvailable: 115225112576,
//     baseDir: "/home/paco/Games",
//   },
//   {
//     name: "FS2",
//     fsTotal: 48895506176,
//     fsAvailable: 31522512576,
//     baseDir: "/home/paco/Games2",
//   },
//   {
//     name: "FS3",
//     fsTotal: 48895506176,
//     fsAvailable: 1522512576,
//     baseDir: "/home/paco/Games3",
//   },
// ];

const data = [
  { label: "Inactive users", value: 28 },
  { label: "Active users", value: 12 },
];
</script>
