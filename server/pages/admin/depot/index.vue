<template>
  <div class="mx-auto w-full max-w-7xl space-y-8 text-zinc-100">
    <header class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">Admin · Depot</p>
        <h1 class="mt-2 text-3xl font-semibold tracking-tight">Catalog discovery</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Discover owned products and review their metadata before adding them to your depot.
          Discovery never publishes or downloads content by itself.
        </p>
      </div>
      <span class="inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200">
        <span class="h-1.5 w-1.5 rounded-full bg-amber-400" />
        {{ activeProvider.label }} provider not connected
      </span>
    </header>

    <!-- Provider selector: minimal addition; GOG flow below remains untouched. -->
    <nav aria-label="Store provider" class="flex flex-wrap gap-2">
      <button
        v-for="provider in providers"
        :key="provider.id"
        type="button"
        :aria-pressed="provider.id === activeProviderId"
        class="rounded-lg border px-3.5 py-2 text-sm font-medium transition"
        :class="provider.id === activeProviderId
          ? 'border-blue-500/60 bg-blue-500/10 text-blue-200'
          : 'border-zinc-700 text-zinc-300 hover:border-zinc-600'"
        @click="selectProvider(provider.id)"
      >
        {{ provider.label }}
      </button>
    </nav>

    <section v-if="activeProviderId === 'gog'" class="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
      <div class="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
        <div class="flex items-start gap-4">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300">
            <MagnifyingGlassIcon class="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 class="text-base font-semibold">Discover catalog entries</h2>
            <p class="mt-1 text-sm leading-6 text-zinc-400">
              Search by title or provide a GOG product ID. Connect a supported account or catalog adapter to retrieve owned products and available releases.
            </p>
          </div>
        </div>

        <form class="mt-6 space-y-4" @submit.prevent="discoverGog">
          <div>
            <label for="gog-query" class="mb-2 block text-sm font-medium text-zinc-300">Title or GOG product ID</label>
            <div class="flex flex-col gap-3 sm:flex-row">
              <input
                id="gog-query"
                v-model.trim="gogQuery"
                type="search"
                autocomplete="off"
                placeholder="e.g. product name or numeric ID"
                class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="submit"
                :disabled="loading || !gogQuery"
                class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowPathIcon v-if="loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
                <MagnifyingGlassIcon v-else class="h-4 w-4" aria-hidden="true" />
                {{ loading ? 'Searching…' : 'Discover' }}
              </button>
            </div>
          </div>
          <p v-if="errorMessage" role="alert" class="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-200">
            {{ errorMessage }}
          </p>
        </form>
      </div>

      <aside class="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
        <div class="flex items-center gap-3">
          <ShieldCheckIcon class="h-5 w-5 text-emerald-400" aria-hidden="true" />
          <h2 class="text-base font-semibold">Safe ingestion flow</h2>
        </div>
        <ol class="mt-5 space-y-4">
          <li v-for="(step, index) in steps" :key="step.title" class="flex gap-3">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-xs font-semibold text-zinc-400">{{ index + 1 }}</span>
            <div>
              <p class="text-sm font-medium text-zinc-200">{{ step.title }}</p>
              <p class="mt-0.5 text-xs leading-5 text-zinc-500">{{ step.description }}</p>
            </div>
          </li>
        </ol>
        <p class="mt-5 border-t border-zinc-800 pt-4 text-xs leading-5 text-zinc-500">
          Store credentials and acquisition belong in a server-side adapter. Never paste account passwords or tokens here.
        </p>
      </aside>
    </section>

    <section v-else class="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
      <div class="flex items-start gap-4">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300">
          <MagnifyingGlassIcon class="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 class="text-base font-semibold">Owned {{ activeProvider.label }} titles</h2>
          <p class="mt-1 text-sm leading-6 text-zinc-400">
            {{ activeProviderId === 'epic'
              ? 'Loads the entitlements owned by the linked Epic account. Ingest streams the raw depot files directly into the depot.'
              : 'Loads the titles owned by the linked Ubisoft account. Ingest streams the raw game files directly into the depot.' }}
          </p>
        </div>
      </div>

      <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          :disabled="loading"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          @click="loadLibrary"
        >
          <ArrowPathIcon v-if="loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
          <MagnifyingGlassIcon v-else class="h-4 w-4" aria-hidden="true" />
          {{ loading ? 'Loading…' : 'Load owned titles' }}
        </button>
      </div>
      <p v-if="errorMessage" role="alert" class="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-200">
        {{ errorMessage }}
      </p>
    </section>

    <section class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/70">
      <div class="flex flex-col gap-3 border-b border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 class="font-semibold">Discovered products</h2>
          <p class="mt-1 text-sm text-zinc-500">Review identity and available content before choosing what to ingest.</p>
        </div>
        <span class="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400">{{ products.length }} results</span>
      </div>

      <div v-if="products.length === 0" class="px-5 py-14 text-center sm:px-6">
        <ArchiveBoxIcon class="mx-auto h-9 w-9 text-zinc-600" aria-hidden="true" />
        <h3 class="mt-4 text-sm font-semibold text-zinc-200">No products discovered</h3>
        <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
          Connect the {{ activeProvider.label }} discovery provider, then search for a title or sync your owned library. Results will appear here for review.
        </p>
      </div>

      <div v-else class="divide-y divide-zinc-800">
        <article v-for="product in products" :key="product.id" class="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-medium text-zinc-100">{{ product.title }}</h3>
              <span class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{{ activeProvider.label }} · {{ product.id }}</span>
            </div>
            <p class="mt-1 text-sm text-zinc-500">{{ product.description || 'No product description provided.' }}</p>
            <p v-if="product.releaseCount !== undefined" class="mt-2 text-xs text-zinc-500">{{ product.releaseCount }} available release{{ product.releaseCount === 1 ? '' : 's' }}</p>
          </div>
          <button
            type="button"
            :disabled="product.ingesting"
            class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3.5 py-2 text-sm font-medium text-zinc-200 transition hover:border-blue-500/60 hover:bg-blue-500/10 disabled:opacity-50"
            @click="ingest(product)"
          >
            <ArrowDownTrayIcon class="h-4 w-4" aria-hidden="true" />
            {{ product.ingesting ? 'Queueing…' : 'Ingest selected' }}
          </button>
        </article>
      </div>
    </section>

    <p v-if="notice" role="status" class="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">{{ notice }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
} from '@heroicons/vue/24/outline';

definePageMeta({
  layout: 'admin',
});

type ProviderId = 'gog' | 'epic' | 'ubisoft';

interface DiscoveredProduct {
  id: string;
  title: string;
  description?: string;
  releaseCount?: number;
  ingesting?: boolean;
  // Epic: identifiers required by the Epic ingest endpoint.
  namespace?: string;
  catalogItemId?: string;
  appName?: string;
  // Ubisoft: identifiers required by the Ubisoft ingest endpoint.
  spaceId?: string;
  userId?: string;
  gameTitle?: string;
}

const providers: Array<{ id: ProviderId; label: string }> = [
  { id: 'gog', label: 'GOG' },
  { id: 'epic', label: 'Epic' },
  { id: 'ubisoft', label: 'Ubisoft' },
];

const activeProviderId = ref<ProviderId>('gog');
const activeProvider = computed(() => providers.find((p) => p.id === activeProviderId.value) || providers[0]);

const gogQuery = ref('');
const loading = ref(false);
const errorMessage = ref('');
const notice = ref('');
const products = ref<DiscoveredProduct[]>([]);
const steps = [
  { title: 'Discover', description: 'Find owned GOG products and inspect available metadata.' },
  { title: 'Review', description: 'Confirm the product and select the releases to stage.' },
  { title: 'Ingest', description: 'Stage installer assets for verification before publication.' },
];

function selectProvider(id: ProviderId) {
  if (activeProviderId.value === id) return;
  activeProviderId.value = id;
  products.value = [];
  errorMessage.value = '';
  notice.value = '';
}

function resetError() {
  errorMessage.value = '';
  notice.value = '';
}

async function discoverGog() {
  if (!gogQuery.value) return;
  loading.value = true;
  resetError();
  try {
    const response = await $fetch<{ products: DiscoveredProduct[] }>(
      '/api/v1/admin/depot/gog/discover',
      { method: 'POST', body: { query: gogQuery.value } },
    );
    products.value = response.products;
  } catch (error) {
    products.value = [];
    errorMessage.value = error instanceof Error
      ? `GOG discovery is not available: ${error.message}`
      : 'GOG discovery is not available. Configure a server-side GOG provider and try again.';
  } finally {
    loading.value = false;
  }
}

async function loadLibrary() {
  loading.value = true;
  resetError();
  try {
    const response = await $fetch<{ titles: DiscoveredProduct[] }>(
      `/api/v1/admin/depot/${activeProviderId.value}/library`,
      { method: 'GET' },
    );
    products.value = response.titles;
  } catch (error) {
    products.value = [];
    const label = activeProvider.value.label;
    errorMessage.value = error instanceof Error
      ? `${label} library is not available: ${error.message}`
      : `${label} library is not available. Link a ${label} account on the server first.`;
  } finally {
    loading.value = false;
  }
}

async function ingest(product: DiscoveredProduct) {
  product.ingesting = true;
  notice.value = '';
  try {
    if (activeProviderId.value === 'gog') {
      await $fetch('/api/v1/admin/depot/gog/ingest', {
        method: 'POST',
        body: { productId: product.id },
      });
    } else if (activeProviderId.value === 'epic') {
      await $fetch('/api/v1/admin/depot/epic/ingest', {
        method: 'POST',
        body: {
          namespace: product.namespace,
          catalogItemId: product.catalogItemId,
          appName: product.appName,
        },
      });
    } else {
      await $fetch('/api/v1/admin/depot/ubisoft/ingest', {
        method: 'POST',
        body: {
          spaceId: product.spaceId,
          userId: product.userId,
          gameTitle: product.gameTitle || product.title,
        },
      });
    }
    notice.value = `Ingestion queued for ${product.title}.`;
  } catch (error) {
    const label = activeProvider.value.label;
    notice.value = error instanceof Error
      ? `Could not queue ${product.title}: ${error.message}`
      : `Could not queue ${product.title}. Configure the server-side ${label} ingestion provider first.`;
  } finally {
    product.ingesting = false;
  }
}
</script>
