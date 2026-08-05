<template>
  <div v-if="group">
    <h1 class="text-xl font-semibold text-zinc-100">
      {{ group.name }}
    </h1>
    <p class="mt-1 text-sm text-zinc-400">
      {{ group.description }}
    </p>

    <!-- Details Section -->
    <div class="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <h2 class="text-base font-semibold text-zinc-100 mb-4">
        {{ $t("users.admin.groups.details") }}
      </h2>
      <div class="space-y-4 max-w-md">
        <div>
          <label class="text-sm/6 font-medium text-zinc-100">
            {{ $t("users.admin.groups.name") }}
          </label>
          <input
            v-model="editName"
            type="text"
            class="mt-1 block w-full rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 focus:outline-blue-600"
          />
        </div>
        <div>
          <label class="text-sm/6 font-medium text-zinc-100">
            {{ $t("users.admin.groups.descriptionField") }}
          </label>
          <input
            v-model="editDescription"
            type="text"
            class="mt-1 block w-full rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 focus:outline-blue-600"
          />
        </div>
        <button
          class="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          @click="saveDetails"
        >
          {{ $t("common.save") }}
        </button>
      </div>
    </div>

    <!-- Members Section -->
    <div class="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <h2 class="text-base font-semibold text-zinc-100 mb-4">
        {{ $t("users.admin.groups.members") }}
      </h2>

      <!-- OIDC managed banner -->
      <div
        v-if="oidcEnabled"
        class="mb-4 rounded-md bg-blue-900/30 border border-blue-700/50 p-4"
      >
        <p class="text-sm text-blue-300">
          {{ $t("users.admin.groups.oidcManagedNote") }}
        </p>
      </div>

      <div v-if="group.users.length === 0" class="text-sm text-zinc-400">
        {{ $t("users.admin.groups.noMembers") }}
      </div>
      <ul class="space-y-2">
        <li
          v-for="member in group.users"
          :key="member.id"
          class="flex items-center justify-between rounded-md bg-zinc-800/50 px-3 py-2"
        >
          <!-- eslint-disable-next-line @intlify/vue-i18n/no-raw-text -->
          <span class="text-sm text-zinc-100">
            {{ member.displayName }}
            <!-- eslint-disable-next-line @intlify/vue-i18n/no-raw-text -->
            <span class="text-zinc-400">({{ member.username }})</span>
          </span>
          <button
            v-if="!oidcEnabled"
            class="text-sm text-red-400 hover:text-red-300"
            @click="removeMember(member.id)"
          >
            {{ $t("users.admin.groups.removeMember") }}
          </button>
        </li>
      </ul>

      <!-- Add member -->
      <div v-if="!oidcEnabled" class="mt-4 flex items-center gap-2">
        <select
          v-model="selectedUserId"
          class="rounded-md bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 focus:outline-blue-600"
        >
          <option value="" disabled>
            {{ $t("users.admin.groups.addMember") }}
          </option>
          <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
          <option
            v-for="user in availableUsers"
            :key="user.id"
            :value="user.id"
          >
            {{ user.displayName }} ({{ user.username }})
          </option>
          <!-- eslint-enable @intlify/vue-i18n/no-raw-text -->
        </select>
        <button
          class="rounded-md bg-blue-600 px-2 py-1 text-sm font-semibold text-white hover:bg-blue-500"
          :disabled="!selectedUserId"
          @click="addMember"
        >
          {{ $t("add") }}
        </button>
      </div>
    </div>

    <!-- Age Restriction Slider Section -->
    <div class="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <h2 class="text-base font-semibold text-zinc-100 mb-4">
        {{ $t("users.admin.groups.maximumContentAge") }}
      </h2>
      <p class="text-sm text-zinc-400 mb-4">
        {{ $t("users.admin.groups.maximumContentAgeDescription") }}
      </p>
      <p class="text-sm text-zinc-400 mb-4">
        {{ $t("users.admin.groups.unratedNote") }}
      </p>

      <div
        v-if="hasManualOverrides"
        class="mb-4 rounded-md bg-yellow-900/30 border border-yellow-700/50 p-3"
      >
        <p class="text-sm text-yellow-300">
          {{ $t("users.admin.groups.manualOverrideNote") }}
        </p>
      </div>

      <div class="max-w-md">
        <div class="flex items-center justify-between mb-2">
          <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
          <span class="text-sm font-medium text-zinc-100">
            {{ sliderAge }}+
          </span>
          <!-- eslint-enable @intlify/vue-i18n/no-raw-text -->
        </div>
        <input
          v-model.number="sliderAge"
          type="range"
          min="0"
          max="18"
          step="1"
          class="w-full cursor-pointer accent-blue-600"
        />
        <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
        <div class="flex justify-between text-xs text-zinc-500 mt-1">
          <span>0</span>
          <span>6</span>
          <span>12</span>
          <span>18</span>
        </div>
        <!-- eslint-enable @intlify/vue-i18n/no-raw-text -->
      </div>

      <div v-if="sliderBannedPreview.length > 0" class="mt-4">
        <p class="text-sm text-zinc-400 mb-2">
          {{ $t("users.admin.groups.bannedRatings") }}
        </p>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="bp in sliderBannedPreview"
            :key="`${bp.organization}:${bp.rating}`"
            class="inline-flex items-center rounded-full bg-red-900/30 border border-red-700/50 px-2 py-0.5 text-xs text-red-300"
          >
            <!-- eslint-disable-next-line @intlify/vue-i18n/no-raw-text -->
            {{ bp.organization }}: {{ bp.rating }}
          </span>
        </div>
      </div>
      <div v-else class="mt-4">
        <p class="text-sm text-zinc-400">
          {{ $t("users.admin.groups.noBannedRatings") }}
        </p>
      </div>

      <button
        type="button"
        class="mt-4 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        @click="applySlider"
      >
        {{ $t("users.admin.groups.applyAgeRestriction") }}
      </button>
    </div>

    <!-- Advanced: Manual Overrides -->
    <div class="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <details>
        <summary class="cursor-pointer text-base font-semibold text-zinc-100">
          {{ $t("users.admin.groups.advancedOverrides") }}
        </summary>
        <div class="mt-4">
          <p class="text-sm text-zinc-400 mb-4">
            {{ $t("users.admin.groups.sliderOverrideWarning") }}
          </p>

          <div
            v-if="group.bannedAgeRatings.length === 0 && !showAddRating"
            class="text-sm text-zinc-400"
          >
            {{ $t("users.admin.groups.noBannedRatings") }}
          </div>

          <div class="space-y-2">
            <div
              v-for="(br, idx) in group.bannedAgeRatings"
              :key="br.id"
              class="flex items-center gap-2"
            >
              <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
              <span
                class="inline-flex items-center rounded-full bg-zinc-800 px-2.5 py-0.5 text-sm font-medium text-zinc-100"
              >
                {{ br.organization }}: {{ br.rating }}
              </span>
              <!-- eslint-enable @intlify/vue-i18n/no-raw-text -->
              <button
                type="button"
                class="text-red-400 hover:text-red-300 text-sm"
                @click="removeRating(idx)"
              >
                {{ $t("users.admin.groups.removeBannedRating") }}
              </button>
            </div>
          </div>

          <div v-if="showAddRating" class="mt-4 flex items-center gap-2">
            <select
              v-model="newRatingOrg"
              class="rounded-md bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 focus:outline-blue-600"
            >
              <option v-for="org in organizations" :key="org" :value="org">
                {{ org }}
              </option>
            </select>
            <select
              v-model="newRatingValue"
              :disabled="!newRatingOrg"
              class="rounded-md bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 focus:outline-blue-600"
            >
              <option v-for="r in availableRatingsForOrg" :key="r" :value="r">
                {{ r }}
              </option>
            </select>
            <button
              type="button"
              class="rounded-md bg-blue-600 px-2 py-1 text-sm font-semibold text-white hover:bg-blue-500"
              :disabled="!newRatingOrg || !newRatingValue"
              @click="addRating"
            >
              {{ $t("add") }}
            </button>
            <button
              type="button"
              class="text-zinc-400 hover:text-zinc-300 text-sm"
              @click="showAddRating = false"
            >
              {{ $t("cancel") }}
            </button>
          </div>
          <button
            v-if="!showAddRating"
            type="button"
            class="mt-4 text-sm text-blue-400 hover:text-blue-300"
            @click="showAddRating = true"
          >
            {{ $t("users.admin.groups.addBannedRating") }}
          </button>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AuthMec } from "~/prisma/client/enums";
import {
  getAvailableRatings,
  getBannedRatingsForMaxAge,
  inferMaxAgeFromBannedRatings,
} from "~/utils/ageRatings";
import { AgeRatingOrganization } from "~/prisma/client/enums";

useHead({ title: "Edit Group" });
definePageMeta({ layout: "admin" });

const route = useRoute();
const groupId = route.params.id as string;

interface GroupMember {
  id: string;
  username: string;
  displayName: string;
}

interface BannedRating {
  id: string;
  organization: string;
  rating: string;
}

interface GroupDetail {
  id: string;
  name: string;
  description: string;
  users: GroupMember[];
  bannedAgeRatings: BannedRating[];
}

const group = ref<GroupDetail | null>(null);
const editName = ref("");
const editDescription = ref("");
const selectedUserId = ref("");
const oidcEnabled = ref(false);

// Rating add state
const showAddRating = ref(false);
const newRatingOrg = ref<AgeRatingOrganization | "">("");
const newRatingValue = ref("");

const organizations = Object.values(AgeRatingOrganization);

// Slider state
const sliderAge = ref(18);

const sliderBannedPreview = computed(() =>
  getBannedRatingsForMaxAge(sliderAge.value),
);

const hasManualOverrides = computed(() => {
  if (!group.value) return false;
  return inferMaxAgeFromBannedRatings(group.value.bannedAgeRatings) === null;
});

const availableRatingsForOrg = computed(() => {
  if (!newRatingOrg.value) return [];
  return getAvailableRatings(newRatingOrg.value as AgeRatingOrganization);
});

watch(newRatingOrg, () => {
  newRatingValue.value = "";
});

// Fetch group
const fetchGroup = async () => {
  group.value = await $dropFetch<GroupDetail>(
    `/api/v1/admin/groups/${groupId}`,
  );
  editName.value = group.value.name;
  editDescription.value = group.value.description;

  // Initialize slider from existing banned ratings
  const inferred = inferMaxAgeFromBannedRatings(group.value.bannedAgeRatings);
  sliderAge.value = inferred ?? 18;
};

// Fetch all users for member add dropdown
interface UserListItem {
  id: string;
  username: string;
  displayName: string;
}
const allUsers = ref<UserListItem[]>([]);
const fetchAllUsers = async () => {
  allUsers.value = await $dropFetch<UserListItem[]>("/api/v1/admin/users");
};

// Check OIDC
const checkOidc = async () => {
  try {
    const auth =
      await $dropFetch<Record<string, unknown>>("/api/v1/admin/auth");
    oidcEnabled.value = !!auth["OpenID" as AuthMec];
  } catch {
    oidcEnabled.value = false;
  }
};

await Promise.all([fetchGroup(), fetchAllUsers(), checkOidc()]);

const availableUsers = computed(() => {
  if (!group.value) return [];
  const memberIds = new Set(group.value.users.map((u) => u.id));
  return allUsers.value.filter(
    (u) => !memberIds.has(u.id) && u.id !== "system",
  );
});

const saveDetails = async () => {
  await $dropFetch(`/api/v1/admin/groups/${groupId}`, {
    method: "PATCH",
    body: { name: editName.value, description: editDescription.value },
  });
  await fetchGroup();
};

const addMember = async () => {
  if (!group.value || !selectedUserId.value) return;
  const newUserIds = [
    ...group.value.users.map((u) => u.id),
    selectedUserId.value,
  ];
  await $dropFetch(`/api/v1/admin/groups/${groupId}/members`, {
    method: "PATCH",
    body: { userIds: newUserIds },
  });
  selectedUserId.value = "";
  await fetchGroup();
};

const removeMember = async (userId: string) => {
  if (!group.value) return;
  const newUserIds = group.value.users
    .filter((u) => u.id !== userId)
    .map((u) => u.id);
  await $dropFetch(`/api/v1/admin/groups/${groupId}/members`, {
    method: "PATCH",
    body: { userIds: newUserIds },
  });
  await fetchGroup();
};

const applySlider = async () => {
  if (!group.value) return;
  const bannedRatings = getBannedRatingsForMaxAge(sliderAge.value);
  await $dropFetch(`/api/v1/admin/groups/${groupId}/ratings`, {
    method: "PATCH",
    body: { bannedRatings },
  });
  await fetchGroup();
};

const addRating = async () => {
  if (!group.value || !newRatingOrg.value || !newRatingValue.value) return;
  const newRatings = [
    ...group.value.bannedAgeRatings.map((br) => ({
      organization: br.organization,
      rating: br.rating,
    })),
    { organization: newRatingOrg.value, rating: newRatingValue.value },
  ];
  await $dropFetch(`/api/v1/admin/groups/${groupId}/ratings`, {
    method: "PATCH",
    body: { bannedRatings: newRatings },
  });
  showAddRating.value = false;
  newRatingOrg.value = "";
  newRatingValue.value = "";
  await fetchGroup();
};

const removeRating = async (idx: number) => {
  if (!group.value) return;
  const newRatings = group.value.bannedAgeRatings
    .filter((_, i) => i !== idx)
    .map((br) => ({ organization: br.organization, rating: br.rating }));
  await $dropFetch(`/api/v1/admin/groups/${groupId}/ratings`, {
    method: "PATCH",
    body: { bannedRatings: newRatings },
  });
  await fetchGroup();
};
</script>
