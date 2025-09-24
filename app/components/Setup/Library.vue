<template>
  <div class="p-8">
    <AdminSourcesPage :token="token" />
  </div>
</template>

<script setup lang="ts">
import AdminSourcesPage from "~/pages/admin/library/sources/index.vue";

const complete = defineModel<boolean>({ required: true });
// Only runs on component load, so it's fine
complete.value = true;

const { token } = defineProps<{ token: string }>();
</script>
