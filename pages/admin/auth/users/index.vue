<template>
  <div>
    <div class="mx-auto max-w-2xl lg:mx-0">
      <h2 class="mt-2 text-xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
        User Management
      </h2>
      <p class="mt-2 text-pretty text-sm font-medium text-zinc-400 sm:text-md/8">
        View and manage all registered users on the platform. You can see their roles, IDs, and other relevant information.
      </p>
    </div>

    <div class="mt-8">
      <!-- Search Bar -->
      <div class="mb-6">
        <div class="relative">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search users by name, username, ID, or auth type..."
            class="block w-full rounded-md border-0 bg-zinc-800/50 py-2 pl-4 pr-10 text-zinc-100 placeholder:text-zinc-500 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
          />
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <MagnifyingGlassIcon class="h-5 w-5 text-zinc-500" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div class="border-b border-zinc-700 py-5">
        <div class="-mt-2 flex flex-wrap items-center justify-between sm:flex-nowrap">
          <div class="mt-2">
            <h3 class="text-base font-semibold text-zinc-100">Users</h3>
          </div>
          <div class="ml-4 mt-2 shrink-0 flex gap-2">
            <Menu as="div" class="relative">
              <MenuButton class="relative inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                Configure authentication
                <ChevronDownIcon class="ml-2 -mr-1 h-5 w-5" aria-hidden="true" />
              </MenuButton>
              <transition
                enter-active-class="transition ease-out duration-100"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100"
                leave-to-class="transform opacity-0 scale-95"
              >
                <MenuItems class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-zinc-900 py-2 shadow-lg ring-1 ring-zinc-800 focus:outline-none">
                  <MenuItem v-slot="{ active }">
                    <NuxtLink
                      to="/admin/auth/simple"
                      :class="[
                        active ? 'bg-zinc-800' : '',
                        'block px-3 py-1 text-sm leading-6 text-zinc-100 w-full text-left'
                      ]"
                    >
                      Invite User
                    </NuxtLink>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      @click="openCreateUserModal"
                      :class="[
                        active ? 'bg-zinc-800' : '',
                        'block px-3 py-1 text-sm leading-6 text-zinc-100 w-full text-left'
                      ]"
                    >
                      Add User Manually
                    </button>
                  </MenuItem>
                </MenuItems>
              </transition>
            </Menu>
          </div>
        </div>
      </div>

      <ul role="list" class="divide-y divide-zinc-800">
        <li v-for="user in filteredUsers" :key="user.id" class="relative flex justify-between gap-x-6 py-5">
          <div class="flex min-w-0 gap-x-4">
            <img 
              :src="useObject(user.profilePicture)" 
              class="h-12 w-12 flex-none rounded-md bg-zinc-800" 
            />
            <div class="min-w-0 flex-auto">
              <p class="text-sm font-semibold leading-6 text-zinc-100">
                {{ user.displayName }}
                <span class="ml-2 text-xs text-zinc-400">({{ user.username }})</span>
              </p>
              <p class="mt-1 flex text-xs leading-5 text-zinc-500">
                {{ user.email }}
                <span class="ml-2">ID: {{ user.id }}</span>
              </p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-x-4">
            <div class="hidden sm:flex sm:flex-col sm:items-end">
              <p class="text-sm leading-6 text-zinc-100 flex items-center gap-2">
                {{ user.admin ? "Administrator" : "User" }}
                <span class="inline-flex items-center rounded-md bg-blue-400/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/20">
                  Simple Auth
                </span>
              </p>
            </div>
            <Menu as="div" class="relative flex-none">
              <MenuButton class="-m-2.5 block p-2.5 text-zinc-500 hover:text-zinc-400">
                <span class="sr-only">Open options</span>
                <EllipsisVerticalIcon class="h-5 w-5" aria-hidden="true" />
              </MenuButton>
              <transition
                enter-active-class="transition ease-out duration-100"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100"
                leave-to-class="transform opacity-0 scale-95"
              >
                <MenuItems
                  class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-zinc-900 py-2 shadow-lg ring-1 ring-zinc-800 focus:outline-none"
                >
                  <MenuItem v-slot="{ active }">
                    <button
                      @click="() => confirmToggleAdmin(user)"
                      :class="[
                        active ? 'bg-zinc-800' : '',
                        'block px-3 py-1 text-sm leading-6 text-zinc-100 w-full text-left'
                      ]"
                    >
                      {{ user.admin ? 'Remove Admin' : 'Make Admin' }}
                    </button>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      @click="() => generateResetLink(user)"
                      :class="[
                        active ? 'bg-zinc-800' : '',
                        'block px-3 py-1 text-sm leading-6 text-zinc-100 w-full text-left'
                      ]"
                    >
                      Reset Password
                    </button>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      @click="() => confirmDeleteUser(user)"
                      :class="[
                        active ? 'bg-zinc-800' : '',
                        'block px-3 py-1 text-sm leading-6 text-red-400 w-full text-left'
                      ]"
                    >
                      Delete User
                    </button>
                  </MenuItem>
                </MenuItems>
              </transition>
            </Menu>
          </div>
        </li>
      </ul>
    </div>
  </div>

  <TransitionRoot appear :show="createUserModalOpen" as="template">
    <Dialog as="div" @close="createUserModalOpen = false" class="relative z-50">
      <TransitionChild
        as="template"
        enter="duration-300 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-200 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/25" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4 text-center">
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="w-full max-w-md transform overflow-hidden rounded-2xl bg-zinc-900 p-6 text-left align-middle shadow-xl transition-all">
              <DialogTitle as="h3" class="text-lg font-medium leading-6 text-zinc-100">
                Create Simple Auth User
              </DialogTitle>
              <form @submit.prevent="createUser" class="mt-4 space-y-4">
                <div>
                  <label for="username" class="block text-sm font-medium text-zinc-300">Username</label>
                  <input
                    type="text"
                    id="username"
                    v-model="newUser.username"
                    required
                    class="mt-1 block w-full rounded-md border-zinc-700 bg-zinc-800 text-zinc-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label for="password" class="block text-sm font-medium text-zinc-300">Password</label>
                  <input
                    type="password"
                    id="password"
                    v-model="newUser.password"
                    required
                    class="mt-1 block w-full rounded-md border-zinc-700 bg-zinc-800 text-zinc-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label for="email" class="block text-sm font-medium text-zinc-300">Email</label>
                  <input
                    type="email"
                    id="email"
                    v-model="newUser.email"
                    required
                    class="mt-1 block w-full rounded-md border-zinc-700 bg-zinc-800 text-zinc-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label for="displayName" class="block text-sm font-medium text-zinc-300">Display Name</label>
                  <input
                    type="text"
                    id="displayName"
                    v-model="newUser.displayName"
                    required
                    class="mt-1 block w-full rounded-md border-zinc-700 bg-zinc-800 text-zinc-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div class="mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    @click="createUserModalOpen = false"
                    class="inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-300 focus:outline-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    :disabled="creating"
                    class="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </form>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems, Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'
import { EllipsisVerticalIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/vue/20/solid'
import type { User } from '@prisma/client'

definePageMeta({
  layout: 'admin',
})

useHead({
  title: 'User Management',
})

// Fetch all users
const headers = useRequestHeaders(['cookie'])
const users = ref<User[]>([])

async function fetchUsers() {
  users.value = await $fetch('/api/v1/admin/users/users', { headers })
}

await fetchUsers()

// Toggle admin status
async function toggleAdmin(user: User) {
  try {
    await $fetch('/api/v1/admin/users/users', {
      method: 'PATCH',
      body: {
        userId: user.id,
        admin: !user.admin
      }
    })
    await fetchUsers()
  } catch (e: any) {
    createModal(
      ModalType.Notification,
      {
        title: 'Failed to update user',
        description: `An error occurred while updating the user: ${e?.statusMessage || 'Unknown error'}`,
        buttonText: 'Close',
      },
      (e, c) => c()
    )
  }
}

// Delete user
async function deleteUser(userId: string) {
  try {
    await $fetch('/api/v1/admin/users/users', {
      method: 'DELETE',
      body: {
        userId
      }
    })
    await fetchUsers()
  } catch (e: any) {
    createModal(
      ModalType.Notification,
      {
        title: 'Failed to delete user',
        description: `An error occurred while deleting the user: ${e?.statusMessage || 'Unknown error'}`,
        buttonText: 'Close',
      },
      (e, c) => c()
    )
  }
}

// Confirm before toggling admin status
async function confirmToggleAdmin(user: User) {
  if (user.admin) {
    createModal(
      ModalType.Confirmation,
      {
        title: 'Remove Administrator',
        description: 'Are you sure you want to remove administrator privileges from this user? This action could be dangerous if they are the last administrator.',
        buttonText: 'Remove Admin',
        buttonType: 'danger',
      },
      async (event, close) => {
        if (event === 'cancel') {
          close();
          return;
        }
        
        try {
          await toggleAdmin(user);
        } catch (error: any) {
          createModal(
            ModalType.Notification,
            {
              title: 'Failed to update user',
              description: error?.statusMessage || 'Unknown error',
              buttonText: 'Close',
            },
            (event, close) => close()
          );
        }
        close();
      }
    );
  } else {
    await toggleAdmin(user);
  }
}

// Confirm before deleting user
async function confirmDeleteUser(user: User) {
  createModal(
    ModalType.Confirmation,
    {
      title: 'Delete User',
      description: `Are you sure you want to delete ${user.displayName}? This action cannot be undone${user.admin ? ' and could be dangerous if they are the last administrator' : ''}.`,
      buttonText: 'Delete User',
      buttonType: 'danger',
    },
    async (event, close) => {
      if (event === 'cancel') {
        close();
        return;
      }
      
      try {
        await deleteUser(user.id);
        await fetchUsers();
      } catch (error: any) {
        createModal(
          ModalType.Notification,
          {
            title: 'Failed to delete user',
            description: error?.statusMessage || 'Unknown error',
            buttonText: 'Close',
          },
          (event, close) => close()
        );
      }
      close();
    }
  );
}

// Add these refs for the create user form
const createUserModalOpen = ref(false)
const creating = ref(false)
const newUser = ref({
  username: '',
  password: '',
  email: '',
  displayName: '',
})

function openCreateUserModal() {
  createUserModalOpen.value = true
}

async function createUser() {
  creating.value = true
  try {
    await $fetch('/api/v1/admin/users/users', {
      method: 'POST',
      body: newUser.value
    })
    await fetchUsers()
    createUserModalOpen.value = false
    newUser.value = {
      username: '',
      password: '',
      email: '',
      displayName: '',
    }
  } catch (e: any) {
    createModal(
      ModalType.Notification,
      {
        title: 'Failed to create user',
        description: `An error occurred while creating the user: ${e?.statusMessage || 'Unknown error'}`,
        buttonText: 'Close',
      },
      (e, c) => c()
    )
  } finally {
    creating.value = false
  }
}

// Add search functionality
const searchQuery = ref('')

// Filter users based on search query
const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  
  const query = searchQuery.value.toLowerCase()
  return users.value.filter(user => 
    user.displayName?.toLowerCase().includes(query) ||
    user.username.toLowerCase().includes(query) ||
    user.id.toLowerCase().includes(query) ||
    'simple auth'.includes(query)
  )
})

function generateResetLink(user: User) {
  // Create a reset token using the user's ID and current timestamp
  const timestamp = Date.now();
  const token = btoa(`${user.id}:${timestamp}`);
  
  const resetLink = `${window.location.origin}/reset-password/${token}`;
  
  // Show the reset link in a modal with word-break and larger width
  createModal(
    ModalType.Notification,
    {
      title: 'Password Reset Link',
      description: `Share this link with the user to reset their password:\n\n${resetLink}`,
      buttonText: 'Close',
      className: 'sm:max-w-7xl',
      descriptionClass: 'break-all',
    },
    (event, close) => {
      // Copy to clipboard when modal opens
      navigator.clipboard.writeText(resetLink);
      close();
    }
  );
}
</script> 
