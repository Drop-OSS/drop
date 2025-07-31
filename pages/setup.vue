<template>
  <div class="min-h-screen flex flex-col">
    <div class="grow grid grid-cols-1 lg:grid-cols-2">
      <div class="border-b lg:border-b-0 lg:border-r border-zinc-700">
        <header
          class="mx-auto w-full max-w-7xl px-6 pt-6 sm:pt-10 lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:px-8"
        >
          <DropWordmark />
        </header>
        <main
          class="mx-auto w-full max-w-7xl px-6 py-24 sm:py-32 lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:px-8"
        >
          <div>
            <h1 class="text-4xl font-display font-bold text-zinc-100">
              {{ $t("setup.welcome") }}
            </h1>
            <LanguageSelectorListbox :show-text="false" class="mt-4 max-w-sm" />
            <p class="mt-6 text-zinc-400 max-w-xl">
              {{ $t("setup.welcomeDescription") }}
            </p>
          </div>
          <ul role="list" class="mt-10 divide-y divide-zinc-700/5">
            <li
              v-for="(action, actionIdx) in actions"
              :key="action.name"
              class="relative flex gap-x-6 py-6"
            >
              <div
                class="flex size-10 flex-none items-center justify-center rounded-lg shadow-xs outline-1 outline-zinc-100/10"
              >
                <component
                  v-if="!actionsComplete[actionIdx]"
                  :is="action.icon"
                  class="size-6 text-blue-500"
                  aria-hidden="true"
                />
                <CheckIcon v-else class="size-6 text-blue-500" />
              </div>
              <div class="flex-auto">
                <h3 class="text-sm/6 font-semibold text-zinc-100">
                  <button
                    :class="
                      actionsComplete[actionIdx]
                        ? 'line-through text-zinc-300'
                        : ''
                    "
                    @click="() => (currentAction = actionIdx)"
                  >
                    <span class="absolute inset-0" aria-hidden="true" />
                    {{ action.name }}
                  </button>
                </h3>
                <p class="mt-2 text-sm/6 text-zinc-400">
                  {{ action.description }}
                </p>
              </div>
              <div class="flex-none self-center">
                <ChevronRightIcon
                  class="size-5 text-gray-400"
                  aria-hidden="true"
                />
              </div>
            </li>
          </ul>
          <LoadingButton
            @click="() => finish()"
            :disabled="!finished"
            :loading="finishLoading"
          >
            Let's go &rarr;
          </LoadingButton>
        </main>
      </div>
      <component
        v-if="actions[currentAction] && !useModal"
        :is="actions[currentAction].page"
        v-model="actionsComplete[currentAction]"
        :token="bearerToken"
      />
      <div
        v-else-if="!useModal"
        class="bg-zinc-950/30 flex items-center justify-center"
      >
        <p class="uppercase text-sm font-display text-zinc-700 font-bold">
          no page
        </p>
      </div>
    </div>
    <div>
      <Transition>
        <div v-if="useModal && open" class="relative z-10">
          <div class="fixed inset-0 bg-zinc-900/75 transition-opacity" />

          <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div
              class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0"
            >
              <div
                class="relative transform overflow-hidden rounded-lg bg-zinc-900 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm"
              >
                <div>
                  <component
                    :is="actions[currentAction].page"
                    v-model="actionsComplete[currentAction]"
                    :token="bearerToken"
                  />
                </div>
                <div class="mt-5 sm:mt-6 p-4">
                  <button
                    type="button"
                    class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    @click="currentAction = -1"
                  >
                    {{ $t("common.close") }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.v-enter-active,
.v-leave-active {
  transition: opacity 0.2s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>

<script setup lang="ts">
import { SetupAccount, SetupLibrary } from "#components";
import {
  CheckIcon,
  ChevronRightIcon,
  ServerStackIcon,
  UserCircleIcon,
} from "@heroicons/vue/24/outline";
import { Transition, type Component } from "vue";
import { breakpointsTailwind, useBreakpoints } from "@vueuse/core";

const breakpoints = useBreakpoints(breakpointsTailwind);
const useModal = computed(() => !breakpoints.lg.value);

const { t } = useI18n();

useHead({
  title: t("setup.welcome"),
});

const route = useRoute();
const router = useRouter();
const token = route.query.token;
if (!token)
  throw createError({
    statusCode: 400,
    statusMessage: "No token.",
    fatal: true,
  });
const bearerToken = `Bearer ${token}`;

const allowed = await $dropFetch("/api/v1/admin", {
  headers: { Authorization: bearerToken },
});
if (!allowed)
  throw createError({
    statusCode: 400,
    statusMessage: "Invalid setup token. Please check the URL you opened.",
    fatal: true,
  });

const currentAction = ref(-1);
const actions = ref<
  Array<{
    name: string;
    description: string;
    icon: Component;
    page: Component;
  }>
>([
  {
    name: t("setup.stages.account.name"),
    description: t("setup.stages.account.description"),
    icon: UserCircleIcon,
    page: SetupAccount,
  },
  {
    name: t("setup.stages.library.name"),
    description: t("setup.stages.library.description"),
    icon: ServerStackIcon,
    page: SetupLibrary,
  },
]);

const actionsComplete = ref(Array(actions.value.length).fill(false));

const finished = computed(
  () => actionsComplete.value.filter((e) => !e).length == 0,
);

const open = computed(() => currentAction.value != -1);
definePageMeta({
  layout: false,
});

const finishLoading = ref(false);
async function finish() {
  currentAction.value = -1;
  finishLoading.value = true;
  await $dropFetch("/api/v1/setup", {
    headers: { Authorization: bearerToken },
    method: "POST",
  });
  router.push("/signin");
}
</script>
