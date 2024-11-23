<template>
  <div>
    <div class="mx-auto max-w-2xl lg:mx-0">
      <h2
        class="mt-2 text-xl font-semibold tracking-tight text-zinc-100 sm:text-3xl"
      >
        Simple authentication
      </h2>
      <p
        class="mt-2 text-pretty text-sm font-medium text-zinc-400 sm:text-md/8"
      >
        Simple authentication uses a system of 'invitations' to create users.
        You can create an invitation, and optionally specify a username or email
        for the user, and then it will generate a magic URL that can be used to
        create an account.
      </p>
    </div>

    <div>
      <div class="border-b border-zinc-700 py-5">
        <div
          class="-mt-2 flex flex-wrap items-center justify-between sm:flex-nowrap"
        >
          <div class="mt-2">
            <h3 class="text-base font-semibold text-zinc-100">Invitations</h3>
          </div>
          <div class="ml-4 mt-2 shrink-0">
            <button
              @click="() => (createModalOpen = true)"
              type="button"
              class="relative inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Create invitation
            </button>
          </div>
        </div>
      </div>
      <ul role="list" class="divide-y divide-zinc-800">
        <li
          v-for="(invitation, invitationIdx) in invitations"
          :key="invitation.id"
          class="relative flex justify-between gap-x-6 py-5"
        >
          <div class="flex min-w-0 gap-x-4">
            <div class="min-w-0 flex-auto">
              <div class="text-sm/6 font-semibold text-zinc-100">
                <p v-if="invitationUrls">
                  {{ invitationUrls[invitationIdx] }}
                </p>
                <div
                  v-else
                  class="h-4 w-full bg-zinc-800 animate-pulse rounded"
                />
              </div>

              <p class="mt-1 flex text-xs/5 text-gray-500">
                {{ invitation.username ?? "No username enforced." }}
                |
                {{ invitation.email ?? "No email enforced." }}
              </p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-x-4">
            <div class="hidden sm:flex sm:flex-col sm:items-end">
              <p class="text-sm/6 text-zinc-100">
                {{
                  invitation.isAdmin ? "Admin invitation" : "User invitation"
                }}
              </p>
              <p class="mt-1 text-xs/5 text-gray-500">
                Expires:
                <time :datetime="invitation.expires">{{
                  new Date(invitation.expires).toLocaleString()
                }}</time>
              </p>
            </div>
            <button @click="() => deleteInvitation(invitation.id)">
              <TrashIcon
                class="h-5 w-5 flex-none text-red-600"
                aria-hidden="true"
              />
            </button>
          </div>
        </li>
      </ul>

      <div class="py-4 text-zinc-400 text-sm" v-if="invitations.length == 0">
        No invitations.
      </div>
    </div>

    <TransitionRoot as="template" :show="createModalOpen">
      <Dialog class="relative z-50" @close="createModalOpen = false">
        <TransitionChild
          as="template"
          enter="ease-out duration-300"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div
            class="fixed inset-0 bg-zinc-950 bg-opacity-75 transition-opacity"
          />
        </TransitionChild>

        <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div
            class="flex min-h-full items-start justify-center p-4 text-center sm:items-center sm:p-0"
          >
            <TransitionChild
              as="template"
              enter="ease-out duration-300"
              enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enter-to="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leave-from="opacity-100 translate-y-0 sm:scale-100"
              leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <form
                @submit.prevent="() => invite_wrapper()"
                class="relative transform rounded-lg bg-zinc-900 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg"
              >
                <div class="px-4 pb-4 pt-5 space-y-4 sm:p-6 sm:pb-4">
                  <div class="sm:flex sm:items-start">
                    <div class="mt-3 text-center sm:mt-0 sm:text-left">
                      <DialogTitle
                        as="h3"
                        class="text-base font-semibold text-zinc-100"
                        >Invite user to Drop
                      </DialogTitle>
                      <div class="mt-2">
                        <p class="text-sm text-zinc-400">
                          Drop will generate a URL that you can send to the
                          person you want to invite. You can optionally specify
                          a username or email for them to use.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="space-y-6">
                    <div>
                      <label
                        for="username"
                        class="block text-sm font-medium leading-6 text-zinc-100"
                        >Username (optional)</label
                      >
                      <p
                        :class="[
                          validUsername ? 'text-blue-400' : 'text-red-500',
                          'block text-xs font-medium leading-6',
                        ]"
                      >
                        Must be 5 or more characters
                      </p>
                      <div class="mt-2">
                        <input
                          id="username"
                          name="invite-username"
                          type="text"
                          autocomplete="username"
                          v-model="username"
                          placeholder="myUsername"
                          class="block w-full rounded-md border-0 py-1.5 px-3 bg-zinc-800 disabled:bg-zinc-900/80 text-zinc-100 disabled:text-zinc-400 shadow-sm ring-1 ring-inset ring-zinc-700 disabled:ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        for="email"
                        class="block text-sm font-medium leading-6 text-zinc-100"
                        >Email address (optional)</label
                      >
                      <p
                        :class="[
                          validEmail ? 'text-blue-400' : 'text-red-500',
                          'block text-xs font-medium leading-6',
                        ]"
                      >
                        Must be in the format user@example.com
                      </p>
                      <div class="mt-2">
                        <input
                          id="email"
                          name="invite-email"
                          type="email"
                          autocomplete="email"
                          v-model="email"
                          placeholder="me@example.com"
                          class="block w-full rounded-md border-0 py-1.5 px-3 bg-zinc-800 disabled:bg-zinc-900/80 text-zinc-100 disabled:text-zinc-400 shadow-sm ring-1 ring-inset ring-zinc-700 disabled:ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                        />
                      </div>
                    </div>

                    <div>
                      <SwitchGroup
                        as="div"
                        class="flex items-center justify-between"
                      >
                        <span class="flex grow flex-col">
                          <SwitchLabel
                            as="span"
                            class="text-sm/6 font-medium text-zinc-100"
                            passive
                            >Admin invitation
                          </SwitchLabel>
                          <SwitchDescription
                            as="span"
                            class="text-sm text-zinc-400"
                            >Create this user as an
                            administrator</SwitchDescription
                          >
                        </span>
                        <Switch
                          v-model="isAdmin"
                          :class="[
                            isAdmin ? 'bg-blue-600' : 'bg-zinc-800',
                            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
                          ]"
                        >
                          <span
                            aria-hidden="true"
                            :class="[
                              isAdmin ? 'translate-x-5' : 'translate-x-0',
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                            ]"
                          />
                        </Switch>
                      </SwitchGroup>
                    </div>

                    <div>
                      <Listbox as="div" v-model="expiryKey">
                        <ListboxLabel
                          class="block text-sm/6 font-medium text-zinc-100"
                          >Expires in</ListboxLabel
                        >
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
                                as="template"
                                v-for="[label, _] in Object.entries(expiry)"
                                :key="label"
                                :value="label"
                                v-slot="{ active, selected }"
                              >
                                <li
                                  :class="[
                                    active
                                      ? 'bg-blue-600 text-white'
                                      : 'text-zinc-300',
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
                                    <CheckIcon
                                      class="h-5 w-5"
                                      aria-hidden="true"
                                    />
                                  </span>
                                </li>
                              </ListboxOption>
                            </ListboxOptions>
                          </transition>
                        </div>
                      </Listbox>
                    </div>
                  </div>

                  <div v-if="error" class="mt-1 rounded-md bg-red-600/10 p-4">
                    <div class="flex">
                      <div class="flex-shrink-0">
                        <XCircleIcon
                          class="h-5 w-5 text-red-600"
                          aria-hidden="true"
                        />
                      </div>
                      <div class="ml-3">
                        <h3 class="text-sm font-medium text-red-600">
                          {{ error }}
                        </h3>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  class="bg-zinc-800 px-4 py-3 sm:flex sm:gap-x-2 sm:flex-row-reverse sm:px-6"
                >
                  <LoadingButton
                    :loading="loading"
                    type="submit"
                    class="w-full sm:w-fit"
                  >
                    Invite
                  </LoadingButton>
                  <button
                    type="button"
                    class="mt-3 inline-flex w-full justify-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-700 hover:bg-zinc-900 sm:mt-0 sm:w-auto"
                    @click="createModalOpen = false"
                    ref="cancelButtonRef"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </div>
</template>

<script setup lang="ts">
import { ClientOnly } from "#build/components";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
  Switch,
  SwitchDescription,
  SwitchGroup,
  SwitchLabel,
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import {
  ChevronRightIcon,
  CheckIcon,
  ChevronUpDownIcon,
} from "@heroicons/vue/20/solid";
import {
  CalendarDateRangeIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/vue/24/solid";
import type { Invitation } from "@prisma/client";
import moment from "moment";
import type { SerializeObject } from "nitropack";
import LoadingButton from "~/components/LoadingButton.vue";

definePageMeta({
  layout: "admin",
});

useHead({
  title: "Simple authentication",
});

const headers = useRequestHeaders(["cookie"]);
const { data } = await useFetch<Array<SerializeObject<Invitation>>>(
  "/api/v1/admin/auth/invitation",
  { headers }
);
const invitations = ref(data.value ?? []);

const generateInvitationUrl = (id: string) =>
  `${window.location.protocol}//${window.location.host}/register?id=${id}`;
const invitationUrls = ref<undefined | Array<string>>();
onMounted(() => {
  invitationUrls.value = invitations.value.map((invitation) =>
    generateInvitationUrl(invitation.id)
  );
});

// Makes username undefined if it's empty
const _username = ref<undefined | string>(undefined);
const username = computed({
  get() {
    return _username.value;
  },
  set(v) {
    if (!v) return (_username.value = undefined);
    _username.value = v;
  },
});
const validUsername = computed(() =>
  _username.value === undefined ? true : _username.value.length >= 5
);

// Same as above
const _email = ref<undefined | string>(undefined);
const email = computed({
  get() {
    return _email.value;
  },
  set(v) {
    if (!v) return (_email.value = undefined);
    _email.value = v;
  },
});
const mailRegex = /^\S+@\S+\.\S+$/g;
const validEmail = computed(() =>
  _email.value === undefined ? true : mailRegex.test(email.value as string)
);

const isAdmin = ref(false);

// Label to parameters to moment.js .add()
const expiry = {
  "3 days": [3, "days"],
  "7 days": [7, "days"],
  "1 month": [1, "month"],
  "6 months": [6, "month"],
  "1 year": [1, "year"],
  Never: [3000, "year"], // Never is relative, right?
};
const expiryKey = ref<keyof typeof expiry>(Object.keys(expiry)[0] as any); // Cast to any because we just know it's okay

const loading = ref(false);
const error = ref<undefined | string>();

async function invite() {
  const expiryDate = moment()
    .add(...expiry[expiryKey.value])
    .toJSON();

  const newInvitation = await $fetch("/api/v1/admin/auth/invitation", {
    method: "POST",
    body: {
      username: username.value,
      email: email.value,
      isAdmin: isAdmin.value,
      expires: expiryDate,
    },
  });

  createModalOpen.value = false;
  email.value = "";
  username.value = "";
  isAdmin.value = false;
  expiryKey.value = Object.keys(expiry)[0] as any; // Same reason as above
  return newInvitation;
}

function invite_wrapper() {
  loading.value = true;
  error.value = undefined;
  invite()
    .then((invitation) => {
      invitations.value.push(invitation);
      invitationUrls.value?.push(generateInvitationUrl(invitation.id));
    })
    .catch((response) => {
      const message = response.statusMessage || "An unknown error occurred";
      error.value = message;
    })
    .finally(() => {
      loading.value = false;
    });
}

async function deleteInvitation(id: string) {
  await $fetch("/api/v1/admin/auth/invitation", {
    method: "DELETE",
    body: {
      id: id,
    },
  });

  const index = invitations.value.findIndex((e) => e.id === id);
  invitations.value.splice(index, 1);
  invitationUrls.value?.splice(index, 1);
}

const createModalOpen = ref(false);
</script>
