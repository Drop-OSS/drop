<template>
  <div class="flex min-h-screen flex-1 bg-zinc-900">
    <div
      class="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24"
    >
      <div class="mx-auto w-full max-w-sm lg:w-96">
        <div>
          <DropLogo class="h-10 w-auto" />
          <h2
            class="mt-8 text-2xl font-bold font-display leading-9 tracking-tight text-zinc-100"
          >
            {{
              superlevel
                ? "Sign in to access protected action"
                : $t("auth.signin.title")
            }}
          </h2>
          <p class="mt-2 text-sm leading-6 text-zinc-400">
            {{
              superlevel
                ? "We need you to sign in again for security reasons while attempting to access more sensitive actions."
                : $t("auth.signin.noAccount")
            }}
          </p>
        </div>

        <div class="mt-10">
          <div>
            <AuthSimple
              v-if="enabledAuthProviders.includes('Simple' as AuthMec)"
            />
            <div
              v-if="enabledAuthProviders.length > 1"
              class="py-4 flex flex-row items-center justify-center gap-x-4 font-bold text-sm text-zinc-600"
            >
              <span class="h-[1px] grow bg-zinc-600" />
              {{ $t("auth.signin.or") }}
              <span class="h-[1px] grow bg-zinc-600" />
            </div>
            <AuthOpenID
              v-if="enabledAuthProviders.includes('OpenID' as AuthMec)"
              :provider-name="oidcProviderName"
            />
          </div>
        </div>
      </div>
    </div>
    <div class="relative hidden w-0 flex-1 lg:block">
      <img
        src="/wallpapers/signin.jpg"
        class="absolute inset-0 h-full w-full object-cover"
        alt=""
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AuthMec } from "~/prisma/client/enums";
import DropLogo from "~/components/DropLogo.vue";

const { t } = useI18n();
const { enabledAuthProviders, oidcProviderName } =
  await $dropFetch("/api/v1/auth");

const route = useRoute();
const superlevel = route.query.superlevel;

definePageMeta({
  layout: false,
});

useHead({
  title: superlevel
    ? "Sign in to access protected action"
    : t("auth.signin.pageTitle"),
});
</script>
