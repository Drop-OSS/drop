<template>
  <div>
    <div>
      <!-- Mobile filter dialog -->
      <TransitionRoot as="template" :show="mobileFiltersOpen">
        <Dialog
          class="relative z-100 lg:hidden"
          @close="mobileFiltersOpen = false"
        >
          <TransitionChild
            as="template"
            enter="transition-opacity ease-linear duration-300"
            enter-from="opacity-0"
            enter-to="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leave-from="opacity-100"
            leave-to="opacity-0"
          >
            <div class="fixed inset-0 bg-black/25" />
          </TransitionChild>

          <div class="fixed inset-0 z-40 flex">
            <TransitionChild
              as="template"
              enter="transition ease-in-out duration-300 transform"
              enter-from="translate-x-full"
              enter-to="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leave-from="translate-x-0"
              leave-to="translate-x-full"
            >
              <DialogPanel
                class="relative ml-auto flex size-full max-w-sm flex-col overflow-y-auto bg-zinc-900 pt-4 pb-6 shadow-xl"
              >
                <div class="flex items-center justify-between px-4">
                  <h2 class="text-lg font-medium text-zinc-100">
                    {{ $t("store.view.srFilters") }}
                  </h2>
                  <button
                    type="button"
                    class="relative -mr-2 flex size-10 items-center justify-center rounded-md bg-zinc-900 p-2 text-zinc-500 hover:bg-zinc-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    @click="mobileFiltersOpen = false"
                  >
                    <span class="absolute -inset-0.5" />
                    <span class="sr-only">{{ $t("common.close") }}</span>
                    <XMarkIcon class="size-6" aria-hidden="true" />
                  </button>
                </div>

                <!-- Filters -->
                <form class="mt-4 border-t border-zinc-700">
                  <Disclosure
                    v-for="section in options"
                    v-slot="{ open }"
                    :key="section.param"
                    as="div"
                    class="border-t border-zinc-700 px-4 py-6"
                  >
                    <h3 class="-mx-2 -my-3 flow-root">
                      <DisclosureButton
                        class="flex w-full items-center justify-between bg-zinc-900 px-2 py-3 text-zinc-500 hover:text-zinc-400"
                      >
                        <span class="font-medium text-zinc-100">{{
                          section.name
                        }}</span>
                        <span class="ml-6 flex items-center">
                          <PlusIcon
                            v-if="!open"
                            class="size-5"
                            aria-hidden="true"
                          />
                          <MinusIcon v-else class="size-5" aria-hidden="true" />
                        </span>
                      </DisclosureButton>
                    </h3>
                    <DisclosurePanel class="pt-6">
                      <div
                        v-if="section.options.length <= 10"
                        class="gap-3 grid grid-cols-2"
                      >
                        <div
                          v-for="(option, optionIdx) in section.options"
                          :key="option.param"
                          class="flex gap-3"
                        >
                          <div class="flex h-5 shrink-0 items-center">
                            <div class="group grid size-4 grid-cols-1">
                              <input
                                v-if="section.multiple"
                                :id="`filter-${section.param}-${option}`"
                                v-model="
                                  (optionValues[section.param] as any)[
                                    option.param
                                  ]
                                "
                                :name="`${section.param}[]`"
                                type="checkbox"
                                class="col-start-1 row-start-1 appearance-none rounded-sm border border-zinc-700 bg-zinc-900 checked:border-blue-600 checked:bg-blue-600 indeterminate:border-blue-600 indeterminate:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-100 forced-colors:appearance-auto"
                              />
                              <input
                                v-else
                                :id="`filter-${section.param}`"
                                :value="optionValues[section.param]"
                                :name="`${section.param}[]`"
                                type="checkbox"
                                class="col-start-1 row-start-1 appearance-none rounded-sm border border-gray-300 bg-white checked:border-blue-600 checked:bg-blue-600 indeterminate:border-blue-600 indeterminate:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-100 forced-colors:appearance-auto"
                                @update:value="
                                  () =>
                                    (optionValues[section.param] = option.param)
                                "
                              />
                            </div>
                          </div>
                          <label
                            :for="`filter-mobile-${section.param}-${optionIdx}`"
                            class="min-w-0 flex-1 text-zinc-400"
                            >{{ option.name }}</label
                          >
                        </div>
                      </div>
                      <MultiItemSelector
                        v-else
                        v-model="[optionValues[section.param] as any][0]"
                        :items="section.options"
                      />
                    </DisclosurePanel>
                  </Disclosure>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </TransitionRoot>

      <main class="mx-auto px-4 sm:px-6 lg:px-8">
        <div
          class="flex items-baseline justify-between border-b border-zinc-700 py-6"
        >
          <div />
          <div class="flex items-center">
            <Menu as="div" class="relative inline-block text-left">
              <div>
                <MenuButton
                  class="group inline-flex justify-center text-sm font-medium text-zinc-400 hover:text-zinc-100"
                >
                  {{ $t("store.view.sort") }}
                  <ChevronDownIcon
                    class="-mr-1 ml-1 size-5 shrink-0 text-gray-400 group-hover:text-zinc-100"
                    aria-hidden="true"
                  />
                </MenuButton>
              </div>

              <transition
                enter-active-class="transition ease-out duration-100"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100"
                leave-to-class="transform opacity-0 scale-95"
              >
                <MenuItems
                  class="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-md bg-zinc-950 shadow-2xl ring-1 ring-white/5 focus:outline-hidden"
                >
                  <div class="py-1">
                    <MenuItem
                      v-for="option in sorts"
                      :key="option.param"
                      v-slot="{ active }"
                    >
                      <button
                        :class="[
                          currentSort == option.param
                            ? 'font-medium text-zinc-100'
                            : 'text-zinc-400',
                          active ? 'bg-zinc-900 outline-hidden' : '',
                          'w-full text-left block px-4 py-2 text-sm',
                        ]"
                        @click="() => (currentSort = option.param)"
                      >
                        {{ option.name }}
                      </button>
                    </MenuItem>
                  </div>
                </MenuItems>
              </transition>
            </Menu>

            <button
              v-if="false"
              type="button"
              class="-m-2 ml-5 p-2 text-zinc-500 hover:text-zinc-400 sm:ml-7"
            >
              <span class="sr-only">{{ $t("store.view.srViewGrid") }}</span>
              <Squares2X2Icon class="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              :class="[
                '-m-2 ml-4 p-2 sm:ml-6 lg:hidden',
                filterQuery
                  ? 'text-zinc-100 hover:text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-400',
              ]"
              @click="mobileFiltersOpen = true"
            >
              <span class="sr-only"> {{ $t("store.view.srFilters") }} </span>
              <FunnelIcon class="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <section aria-labelledby="games-heading" class="pt-6 pb-24">
          <h2 id="games-heading" class="sr-only">
            {{ $t("store.view.srGames") }}
          </h2>

          <div class="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-5">
            <!-- Filters -->
            <form class="hidden lg:block">
              <Disclosure
                v-for="section in options"
                :key="section.param"
                v-slot="{ open }"
                as="div"
                class="border-b border-zinc-700 py-6"
              >
                <h3 class="-my-3 flow-root">
                  <DisclosureButton
                    class="flex w-full items-center justify-between bg-zinc-900 py-3 text-sm text-zinc-500 hover:text-zinc-400"
                  >
                    <span class="font-medium text-zinc-100">{{
                      section.name
                    }}</span>
                    <span class="ml-6 flex items-center">
                      <PlusIcon
                        v-if="!open"
                        class="size-5"
                        aria-hidden="true"
                      />
                      <MinusIcon v-else class="size-5" aria-hidden="true" />
                    </span>
                  </DisclosureButton>
                </h3>
                <DisclosurePanel class="pt-6">
                  <div v-if="section.options.length <= 10" class="space-y-4">
                    <div
                      v-for="(option, optionIdx) in section.options"
                      :key="option.param"
                      class="flex gap-3"
                    >
                      <div class="flex h-5 shrink-0 items-center">
                        <div class="group grid size-4 grid-cols-1">
                          <input
                            v-if="section.multiple"
                            :id="`filter-${section.param}-${optionIdx}`"
                            v-model="
                              (optionValues[section.param] as any)[option.param]
                            "
                            :name="`${section.param}[]`"
                            type="checkbox"
                            class="col-start-1 row-start-1 appearance-none rounded-sm border border-zinc-700 bg-zinc-800 checked:border-blue-600 checked:bg-blue-600 indeterminate:border-blue-600 indeterminate:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-100 forced-colors:appearance-auto"
                          />
                          <input
                            v-else
                            :id="`filter-${section.param}-${optionIdx}`"
                            :value="optionValues[section.param]"
                            :name="`${section.param}[]`"
                            type="radio"
                            class="col-start-1 row-start-1 appearance-none rounded-sm border border-zinc-700 bg-zinc-800 checked:border-blue-600 checked:bg-blue-600 indeterminate:border-blue-600 indeterminate:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-100 forced-colors:appearance-auto"
                            @input="optionValues[section.param] = option.param"
                          />
                        </div>
                      </div>
                      <label
                        :for="`filter-${section.param}-${optionIdx}`"
                        class="text-sm text-zinc-400"
                        >{{ option.name }}</label
                      >
                    </div>
                  </div>
                  <MultiItemSelector
                    v-else
                    v-model="[optionValues[section.param] as any][0]"
                    :items="section.options"
                  />
                </DisclosurePanel>
              </Disclosure>
            </form>

            <!-- Product grid -->
            <div
              v-if="games?.length ?? 0 > 0"
              ref="product-grid"
              class="relative lg:col-span-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7 gap-4"
            >
              <!-- Your content -->
              <GamePanel
                v-for="game in games"
                :key="game.id"
                :game="game"
                :href="`/store/${game.id}`"
                :show-title-description="showGamePanelTextDecoration"
              />
              <div
                v-if="loading"
                class="absolute inset-0 bg-zinc-900/40 flex items-center justify-center"
              >
                <svg
                  aria-hidden="true"
                  class="w-8 h-8 text-transparent animate-spin fill-blue-600"
                  viewBox="0 0 100 101"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                    fill="currentColor"
                  />
                  <path
                    d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                    fill="currentFill"
                  />
                </svg>
              </div>
            </div>
            <div v-else class="flex lg:col-span-4 items-start justify-center">
              <span class="uppercase text-zinc-700 font-display font-bold">{{
                $t("common.noResults")
              }}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  TransitionChild,
  TransitionRoot,
} from "@headlessui/vue";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import {
  ChevronDownIcon,
  FunnelIcon,
  MinusIcon,
  PlusIcon,
  Squares2X2Icon,
} from "@heroicons/vue/20/solid";
import type { SerializeObject } from "nitropack";
import type { GameModel, GameTagModel } from "~/prisma/client/models";
import MultiItemSelector from "./MultiItemSelector.vue";
const { showGamePanelTextDecoration } = await $dropFetch(`/api/v1/settings`);

const mobileFiltersOpen = ref(false);

const props = defineProps<{
  params?: { [key: string]: string };
  extraOptions?: Array<StoreFilterOption>;
  prefilled?: {
    [key: string]: { [key: string]: string | { [key: string]: boolean } };
  };
}>();

const tags =
  await $dropFetch<Array<SerializeObject<GameTagModel>>>("/api/v1/store/tags");

const sorts: Array<StoreSortOption> = [
  {
    name: "Default",
    param: "default",
  },
  {
    name: "Newest",
    param: "newest",
  },
  {
    name: "Recently Added",
    param: "recent",
  },
];
const currentSort = ref(sorts[0].param);

const options: Array<StoreFilterOption> = [
  ...(tags.length > 0
    ? [
        {
          name: "Tags",
          param: "tags",
          multiple: true,
          options: tags.map((e) => ({ name: e.name, param: e.id })),
        },
      ]
    : []),
  {
    name: "Platform",
    param: "platform",
    multiple: true,
    options: Object.values(PlatformClient).map((e) => ({ name: e, param: e })),
  },
  ...(props.extraOptions ?? []),
];
const optionValues = ref<{
  [key: string]: string | undefined | { [key: string]: boolean | undefined };
}>(
  Object.fromEntries(
    options.map((v) => [v.param, v.multiple ? {} : undefined]),
  ),
);
Object.assign(optionValues.value, props.prefilled);

const filterQuery = computed(() => {
  const query = Object.entries(optionValues.value)
    .filter(
      ([_, v]) =>
        v &&
        (typeof v !== "object" || Object.values(v).filter((e) => e).length > 0),
    )
    .map(([n, v]) => {
      if (typeof v === "string") return [`${n}=${v}`];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enabledOptions = Object.entries(v as any).filter(([_, e]) => e);
      return `${n}=${enabledOptions.map(([k, _]) => k).join(",")}`;
    })
    .join("&");
  const extraFilters = props.params
    ? Object.entries(props.params)
        .map(([k, v]) => `${k}=${v}`)
        .join("&")
    : props.params;
  return `${query}${extraFilters ? (query ? "&" : "") + extraFilters : ""}`;
});

const games = ref<Array<SerializeObject<GameModel>>>();
const loading = ref(false);

const productGrid = useTemplateRef<HTMLElement>("product-grid");

const { reset } = useInfiniteScroll(
  productGrid,
  async () => await updateGames(filterQuery.value, false),
  {
    distance: 10,
    canLoadMore: () => {
      return canLoadMore.value;
    },
  },
);

const canLoadMore = ref(true);
async function updateGames(query: string, resetGames: boolean) {
  loading.value = true;
  games.value ??= [];
  const newValues = await $dropFetch<{
    results: Array<SerializeObject<GameModel>>;
    count: number;
  }>(
    `/api/v1/store?take=50&skip=${resetGames ? 0 : games.value?.length || 0}&sort=${currentSort.value}${query ? "&" + query : ""}`,
  );
  if (resetGames) {
    games.value = newValues.results;
    if (import.meta.client) await reset();
  } else {
    games.value.push(...newValues.results);
  }
  canLoadMore.value = games.value.length < newValues.count;
  loading.value = false;
}
watch(filterQuery, (newUrl) => {
  updateGames(newUrl, true);
});
watch(currentSort, (_) => {
  updateGames(filterQuery.value, true);
});

await updateGames(filterQuery.value, true);
</script>
