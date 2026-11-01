<template>
    <div class="space-y-6">
        <header class="flex items-center justify-between pb-4 border-b border-border">
            <div>
                <h1 class="text-2xl font-bold tracking-tight text-foreground">Epic Games Integration</h1>
                <p class="text-sm text-muted-foreground">
                    Connect your Epic Games account to stream and ingest owned titles directly into GameDepot Content-Addressable Storage.
                </p>
            </div>
            <div class="flex items-center gap-2">
                <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="connected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'"
                >
                    {{ connected ? 'Connected' : 'Disconnected' }}
                </span>
            </div>
        </header>

        <!-- Auth Section -->
        <div v-if="!connected" class="p-6 rounded-lg border border-border bg-card space-y-4">
            <h2 class="text-lg font-semibold text-foreground">Connect Account</h2>
            <p class="text-sm text-muted-foreground">
                To connect, generate an Epic Games authorization code using the link below, then paste the code here.
            </p>
            <div class="flex flex-col sm:flex-row gap-3">
                <a
                    href="https://www.epicgames.com/id/api/redirect?clientId=34a02cf8f4414e29b15921876da36f9a&responseType=code"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                    Get Epic Auth Code
                </a>
            </div>
            <form @submit.prevent="handleConnect" class="flex flex-col sm:flex-row gap-3 pt-2">
                <input
                    v-model="authCode"
                    type="text"
                    placeholder="Paste authorization code here"
                    required
                    class="flex-1 px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                    type="submit"
                    :disabled="isConnecting || !authCode"
                    class="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    {{ isConnecting ? 'Connecting...' : 'Connect' }}
                </button>
            </form>
            <p v-if="authError" class="text-sm text-destructive">{{ authError }}</p>
        </div>

        <!-- Library Section -->
        <div v-else class="space-y-4">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div class="relative flex-1 max-w-sm">
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Search owned games..."
                        class="w-full px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        @input="filterGames"
                    />
                </div>
                <button
                    @click="fetchLibrary"
                    :disabled="isLoadingLibrary"
                    class="px-3 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
                >
                    {{ isLoadingLibrary ? 'Refreshing...' : 'Refresh Library' }}
                </button>
            </div>

            <!-- Games Grid -->
            <div v-if="filteredGames.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div
                    v-for="game in filteredGames"
                    :key="game.id"
                    class="p-4 rounded-lg border border-border bg-card space-y-3 flex flex-col justify-between"
                >
                    <div>
                        <h3 class="font-medium text-foreground truncate" :title="game.entitlementName">
                            {{ game.entitlementName }}
                        </h3>
                        <p class="text-xs text-muted-foreground mt-1">
                            Namespace: {{ game.namespace }}
                        </p>
                        <p class="text-xs text-muted-foreground">
                            Item ID: {{ game.catalogItemId }}
                        </p>
                    </div>

                    <button
                        @click="handleIngest(game)"
                        :disabled="isIngesting(game.id)"
                        class="w-full px-3 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {{ isIngesting(game.id) ? 'Ingesting...' : 'Ingest Game' }}
                    </button>
                </div>
            </div>

            <div v-else-if="!isLoadingLibrary" class="text-center py-12 border border-dashed border-border rounded-lg">
                <p class="text-sm text-muted-foreground">No Epic Games titles found.</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const connected = ref(false);
const authCode = ref('');
const isConnecting = ref(false);
const authError = ref('');
const isLoadingLibrary = ref(false);
const searchQuery = ref('');
const games = ref<any[]>([]);
const ingestingIds = ref<Set<string>>(new Set());

const filteredGames = computed(() => {
    if (!searchQuery.value) return games.value;
    const q = searchQuery.value.toLowerCase();
    return games.value.filter(g => g.entitlementName?.toLowerCase().includes(q));
});

const checkConnection = async () => {
    try {
        const res: any = await $fetch('/api/v1/admin/depot/epic/connection');
        connected.value = res.connected;
        if (connected.value) {
            await fetchLibrary();
        }
    } catch (err: any) {
        connected.value = false;
    }
};

const handleConnect = async () => {
    isConnecting.value = true;
    authError.value = '';
    try {
        const res: any = await $fetch('/api/v1/admin/depot/epic/connection', {
            method: 'POST',
            body: { code: authCode.value },
        });

        if (res.success) {
            connected.value = true;
            authCode.value = '';
            await fetchLibrary();
        } else {
            authError.value = res.error || 'Connection failed.';
        }
    } catch (err: any) {
        authError.value = err?.data?.error || err.message || 'Connection failed.';
    } finally {
        isConnecting.value = false;
    }
};

const fetchLibrary = async () => {
    isLoadingLibrary.value = true;
    try {
        const res: any = await $fetch('/api/v1/admin/depot/epic/library');
        if (res.items) {
            games.value = res.items;
        }
    } catch (err: any) {
        console.error('Failed to load Epic library:', err);
    } finally {
        isLoadingLibrary.value = false;
    }
};

const isIngesting = (id: string) => ingestingIds.value.has(id);

const handleIngest = async (game: any) => {
    ingestingIds.value.add(game.id);
    try {
        await $fetch('/api/v1/admin/depot/epic/ingest', {
            method: 'POST',
            body: {
                appName: game.entitlementName,
                namespace: game.namespace,
                catalogItemId: game.catalogItemId,
            },
        });
    } catch (err: any) {
        console.error('Failed to start ingestion:', err);
    } finally {
        setTimeout(() => {
            ingestingIds.value.delete(game.id);
        }, 3000);
    }
};

onMounted(() => {
    checkConnection();
});
</script>
