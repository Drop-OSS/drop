<template>
  <div class="max-w-xl">
    <div
      class="divide-y divide-white/10 overflow-hidden rounded-lg bg-zinc-900 outline -outline-offset-1 outline-white/20 sm:grid sm:grid-cols-2 sm:divide-y-0"
    >
      <div
        v-for="(service, serviceIdx) in services"
        :key="service.name"
        :class="[
          serviceIdx === 0
            ? 'rounded-tl-lg rounded-tr-lg sm:rounded-tr-none'
            : '',
          serviceIdx === 1 ? 'sm:rounded-tr-lg' : '',
          serviceIdx === services.length - 2 ? 'sm:rounded-bl-lg' : '',
          serviceIdx === services.length - 1
            ? 'rounded-br-lg rounded-bl-lg sm:rounded-bl-none'
            : '',
          'group relative border-white/10 bg-zinc-800/50 p-6 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-indigo-500 sm:odd:not-nth-last-2:border-b sm:even:border-l sm:even:not-last:border-b',
        ]"
      >
        <div>
          <span
            :class="[
              serviceMetadata[service.name].iconBackground,
              serviceMetadata[service.name].iconForeground,
              'inline-flex rounded-lg p-3',
            ]"
          >
            <component
              :is="serviceMetadata[service.name].icon"
              class="size-6"
              aria-hidden="true"
            />
          </span>
        </div>
        <div class="mt-8">
          <h3 class="text-base font-semibold text-white">
            <a :href="service.href" class="focus:outline-hidden">
              <!-- Extend touch target to entire panel -->
              <span class="absolute inset-0" aria-hidden="true"></span>
              {{ serviceMetadata[service.name].title }}
            </a>
          </h3>
          <p class="mt-2 text-sm text-zinc-400">
            {{ serviceMetadata[service.name].description }}
          </p>
        </div>
        <span
          class="pointer-events-none absolute top-6 right-6"
          aria-hidden="true"
        >
          <CheckIcon
            :class="[
              'size-6',
              service.healthy ? 'text-green-600' : 'text-zinc-500',
            ]"
          />
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ArrowDownTrayIcon, CheckIcon } from "@heroicons/vue/24/outline";

definePageMeta({
  layout: "admin",
});

const services = await $dropFetch("/api/v1/admin/services");

const { t } = useI18n();

const serviceMetadata = computed(() => ({
  torrential: {
    title: t("services.torrential.title"),
    description: t("services.torrential.description"),
    iconForeground: "text-blue-400",
    iconBackground: "bg-blue-500/10",
    icon: ArrowDownTrayIcon,
  },
  nginx: {
    title: t("services.nginx.title"),
    description: t("services.nginx.description"),
    iconForeground: "text-green-400",
    iconBackground: "bg-green-500/10",
    icon: ArrowDownTrayIcon,
  },
}));
</script>
