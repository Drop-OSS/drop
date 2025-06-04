<template>
  <div class="flex">
    <a
      :href="`/auth/oidc?redirect=${route.query.redirect ?? '/'}`"
      class="transition rounded-md grow inline-flex items-center justify-center bg-white/10 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-white/20"
    >
      <i18n-t keypath="auth.signin.externalProvider" tag="span" scope="global">
        <template #arrow>
          <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
        </template>
      </i18n-t>
    </a>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
</script>
