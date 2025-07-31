<template>
  <div v-if="!noWrapper" class="flex flex-col w-full min-h-screen bg-zinc-900">
    <UserHeader class="z-50" hydrate-on-idle />
    <div class="grow flex">
      <NuxtPage />
    </div>
    <UserFooter class="z-50" hydrate-on-interaction />
  </div>
  <div v-else class="flex w-full min-h-screen bg-zinc-900">
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const i18nHead = useLocaleHead();
const noWrapper = !!route.query.noWrapper;

const { t } = useI18n();

useHead({
  htmlAttrs: {
    lang: i18nHead.value.htmlAttrs.lang,
    // @ts-expect-error head.value.htmlAttrs.dir is not typed as strictly as it should be
    dir: i18nHead.value.htmlAttrs.dir,
  },
  // // seo headers
  // link: [...i18nHead.value.link],
  // meta: [...i18nHead.value.meta],
  titleTemplate(title) {
    return title ? t("titleTemplate", [title]) : t("title");
  },
});
</script>
