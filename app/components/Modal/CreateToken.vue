<template>
  <ModalTemplate v-model="model" size-class="max-w-3xl">
    <template #default>
      <div class="space-y-5">
        <div>
          <label
            for="name"
            class="block text-sm font-medium leading-6 text-zinc-100"
            >{{ $t("account.token.name") }}</label
          >
          <p class="text-zinc-400 block text-xs font-medium leading-6">
            {{ $t("account.token.nameDesc") }}
          </p>
          <div class="mt-2">
            <input
              id="name"
              v-model="name"
              name="name"
              type="text"
              autocomplete="name"
              :placeholder="
                props.suggestedName ?? $t('account.token.namePlaceholder')
              "
              class="block w-full rounded-md border-0 py-1.5 px-3 bg-zinc-800 disabled:bg-zinc-900/80 text-zinc-100 disabled:text-zinc-400 shadow-sm ring-1 ring-inset ring-zinc-700 disabled:ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            />
          </div>
        </div>

        <div>
          <Listbox v-model="expiryKey" as="div">
            <ListboxLabel class="block text-sm/6 font-medium text-zinc-100">{{
              $t("users.admin.simple.inviteExpiryLabel")
            }}</ListboxLabel>
            <div class="relative mt-2">
              <ListboxButton
                class="relative w-full cursor-default rounded-md bg-zinc-800 py-1.5 pl-3 pr-10 text-left text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-600 sm:text-sm/6"
              >
                <span class="block truncate">{{ expiryKey }}</span>
                <span
                  class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"
                >
                  <ChevronUpDownIcon
                    class="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </span>
              </ListboxButton>

              <transition
                leave-active-class="transition ease-in duration-100"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
              >
                <ListboxOptions
                  class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
                >
                  <ListboxOption
                    v-for="[label] in Object.entries(expiry)"
                    :key="label"
                    v-slot="{ active, selected }"
                    as="template"
                    :value="label"
                  >
                    <li
                      :class="[
                        active ? 'bg-blue-600 text-white' : 'text-zinc-300',
                        'relative cursor-default select-none py-2 pl-3 pr-9',
                      ]"
                    >
                      <span
                        :class="[
                          selected
                            ? 'font-semibold text-zinc-100'
                            : 'font-normal',
                          'block truncate',
                        ]"
                        >{{ label }}</span
                      >

                      <span
                        v-if="selected"
                        :class="[
                          active ? 'text-white' : 'text-blue-600',
                          'absolute inset-y-0 right-0 flex items-center pr-4',
                        ]"
                      >
                        <CheckIcon class="h-5 w-5" aria-hidden="true" />
                      </span>
                    </li>
                  </ListboxOption>
                </ListboxOptions>
              </transition>
            </div>
          </Listbox>
        </div>

        <div>
          <label
            for="name"
            class="block text-sm font-medium leading-6 text-zinc-100"
            >{{ $t("account.token.acls") }}</label
          >
          <p class="text-zinc-400 block text-xs font-medium leading-6">
            {{ $t("account.token.aclsDesc") }}
          </p>
          <fieldset class="divide-y divide-zinc-700">
            <div
              v-for="[sectionName, sectionAcls] in Object.entries(
                aclsBySection,
              )"
              :key="sectionName"
              class="grid lg:grid-cols-3 gap-1 py-3"
            >
              <div
                v-for="[acl, description] in Object.entries(sectionAcls)"
                :key="acl"
                class="flex gap-3"
              >
                <div class="flex h-6 shrink-0 items-center">
                  <div class="group grid size-4 grid-cols-1">
                    <input
                      id="acl"
                      v-model="currentACLs[acl]"
                      aria-describedby="acl-description"
                      name="acl"
                      type="checkbox"
                      class="col-start-1 row-start-1 appearance-none rounded-sm border checked:border-blue-600 checked:bg-blue-600 indeterminate:border-blue-600 indeterminate:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-100 border-white/10 bg-white/5 dark:checked:border-blue-500 dark:checked:bg-blue-500 dark:indeterminate:border-blue-500 dark:indeterminate:bg-blue-500 dark:focus-visible:outline-blue-500 dark:disabled:border-white/5 dark:disabled:bg-white/10 dark:disabled:checked:bg-white/10 forced-colors:appearance-auto"
                    />
                    <svg
                      class="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-white/25"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <path
                        class="opacity-0 group-has-checked:opacity-100"
                        d="M3 8L6 11L11 3.5"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <path
                        class="opacity-0 group-has-indeterminate:opacity-100"
                        d="M3 7H11"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </div>
                </div>
                <div class="text-sm/6">
                  <label
                    for="acl"
                    class="font-display font-medium text-white"
                    >{{ acl }}</label
                  >
                  {{ " " }}
                  <span id="acl-description" class="text-xs text-zinc-400"
                    ><span class="sr-only">{{ acl }} </span
                    >{{ description }}</span
                  >
                </div>
              </div>
            </div>
          </fieldset>
        </div>
      </div>
    </template>
    <template #buttons>
      <LoadingButton :loading="props.loading" @click="() => createToken()">
        {{ $t("common.create") }}
      </LoadingButton>
      <button
        class="inline-flex items-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold font-display text-white hover:bg-zinc-700"
        @click="() => cancel()"
      >
        {{ $t("cancel") }}
      </button>
    </template>
  </ModalTemplate>
</template>

<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/vue/24/outline";
import type { DurationLike } from "luxon";

// Reuse for both admin and user tokens

const model = defineModel<boolean>({ required: true });

const { t } = useI18n();

const props = defineProps<{
  acls: { [key: string]: string };
  loading?: boolean;
  suggestedAcls?: string[];
  suggestedName?: string;
}>();

// Label to parameters to moment.js .add()
const expiry: Record<string, DurationLike | undefined> = {
  [t("account.token.expiryMonth")]: {
    month: 1,
  },
  [t("account.token.expiry3Month")]: {
    month: 3,
  },
  [t("account.token.expiry6Month")]: {
    month: 6,
  },
  [t("account.token.expiryYear")]: {
    year: 1,
  },
  [t("account.token.expiry5Year")]: {
    year: 5,
  },
  [t("account.token.noExpiry")]: undefined,
};
const expiryKey = ref<keyof typeof expiry>(Object.keys(expiry)[0]); // Cast to any because we just know it's okay
const name = ref(props.suggestedName ?? "");
const currentACLs = ref<{ [key: string]: boolean }>(
  Object.fromEntries((props.suggestedAcls ?? []).map((v) => [v, true])),
);

const aclsBySection = computed(() => {
  const sections: { [key: string]: { [key: string]: string } } = {};
  for (const [acl, description] of Object.entries(props.acls)) {
    const section = acl.split(":")[0];
    sections[section] ??= {};
    sections[section][acl] = description;
  }
  return sections;
});

const emit = defineEmits<{
  create: [name: string, acls: string[], expiry: DurationLike | undefined];
}>();

function createToken() {
  emit(
    "create",
    name.value,
    Object.entries(currentACLs.value)
      .filter(([_acl, enabled]) => enabled)
      .map(([acl, _enabled]) => acl),
    expiry[expiryKey.value],
  );
}

function cancel() {
  model.value = false;
}

watch(model, (c) => {
  if (!c) {
    name.value = "";
    currentACLs.value = {};
  }
});
</script>
