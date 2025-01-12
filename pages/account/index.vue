<template>
  <div class="flex-1 min-h-[calc(100vh-4rem)] bg-zinc-900 py-10">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-12 space-y-4">
        <h2 class="text-xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">Account Settings</h2>
        <p class="max-w-2xl text-pretty text-sm font-medium text-zinc-400 sm:text-md/8">
          Manage your personal account settings and preferences.
        </p>
        <br>
      </div>

      <!-- Two Column Layout -->
      <div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <!-- Profile Section -->
        <div class="bg-zinc-800 shadow-lg shadow-zinc-900/20 rounded-lg p-6">
          <div class="pb-6 mb-6 border-b border-zinc-700">
            <h3 class="text-lg font-medium leading-6 text-zinc-100">Profile Information</h3>
          </div>
          
          <div class="space-y-6">
            <br>
            <!-- Profile Picture -->
            <div class="flex items-center gap-4">
                <img 
                :src="useObject(user?.profilePicture)" 
                class="h-24 w-24 rounded-lg bg-zinc-800 object-cover ring-1 ring-inset ring-zinc-700" 
                alt="Profile picture"
              />
              <div>
                <span class="block text-sm font-medium text-zinc-300">Current Profile Picture</span>
              </div>
            </div>

            <!-- User Information -->
            <div class="space-y-6">
              <div>
                <label class="block text-sm font-medium text-zinc-300">Username</label>
                <div class="mt-1 flex rounded-md bg-zinc-800/50 shadow-sm ring-1 ring-inset ring-zinc-700">
                  <span class="px-3 py-2 text-zinc-400 text-sm">{{ user?.username }}</span>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-zinc-300">Display Name</label>
                <input
                  type="text"
                  v-model="displayName"
                  class="mt-1 block w-full rounded-md border-zinc-700 bg-zinc-800 text-zinc-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-zinc-300">Email Address</label>
                <input
                  type="email"
                  v-model="email"
                  class="mt-1 block w-full rounded-md border-zinc-700 bg-zinc-800 text-zinc-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-zinc-300">Account Type</label>
                <div class="mt-1 flex rounded-md bg-zinc-800/50 shadow-sm ring-1 ring-inset ring-zinc-700">
                  <span class="px-3 py-2 text-zinc-400 text-sm">{{ user?.admin ? 'Administrator' : 'User' }}</span>
                </div>
              </div>
            </div>

            <!-- Save Button -->
            <div class="flex justify-end pt-4">
              <button
                type="button"
                :disabled="!hasChanges"
                @click="saveChanges"
                class="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>

        <!-- Security Section -->
        <div class="bg-zinc-800 shadow-lg shadow-zinc-900/20 rounded-lg p-6">
          <div class="pb-6 mb-6 border-b border-zinc-700">
            <h3 class="text-lg font-medium leading-6 text-zinc-100">Security</h3>
          </div>
          <br>
          <div class="space-y-4">
            <button
              type="button"
              @click="showChangePasswordModal = true"
              class="w-full rounded-md bg-zinc-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-600"
            >
              Change Password
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const user = useUser()

// Form state
const displayName = ref(user.value?.displayName || '')
const email = ref(user.value?.email || '')

// Track if form has changes
const hasChanges = computed(() => {
  return displayName.value !== user.value?.displayName || 
         email.value !== user.value?.email
})

// Save changes
async function saveChanges() {
  try {
    await $fetch('/api/v1/client/user', {
      method: 'PATCH',
      body: {
        displayName: displayName.value,
        email: email.value,
      }
    })
    
    // Update local user state
    if (user.value) {
      user.value.displayName = displayName.value
      user.value.email = email.value
    }

    createModal(
      ModalType.Notification,
      {
        title: 'Success',
        description: 'Your profile has been updated successfully.',
        buttonText: 'Close',
      },
      (e, c) => c()
    )
  } catch (e: any) {
    createModal(
      ModalType.Notification,
      {
        title: 'Failed to update profile',
        description: `An error occurred while updating your profile: ${e?.statusMessage || 'Unknown error'}`,
        buttonText: 'Close',
      },
      (e, c) => c()
    )
  }
}

// Password change modal state
const showChangePasswordModal = ref(false)

useHead({
  title: 'Account Settings',
})
</script> 
