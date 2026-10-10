import { ref, computed, watch, onMounted } from "vue";
import type { UISlotName, PlayAction } from "~/internal/plugins/types";
import { clientPluginManager } from "~/internal/plugins/ClientPluginManager";

export function usePluginManager() {
  return clientPluginManager;
}

export function usePluginSlots(name: UISlotName) {
  return computed(() => clientPluginManager.slots[name] || []);
}

export function usePlayActions(gameId: string | (() => string)) {
  const actions = ref<PlayAction[]>([]);
  const isLoading = ref(false);

  const resolveId = () => (typeof gameId === "function" ? gameId() : gameId);

  const refreshActions = async () => {
    const id = resolveId();
    if (!id) {
      actions.value = [];
      return;
    }
    isLoading.value = true;
    try {
      actions.value = await clientPluginManager.getPlayActions(id);
    } catch (err) {
      console.error(`Failed to load play actions for game ${id}:`, err);
      actions.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  onMounted(() => {
    refreshActions();
  });

  if (typeof gameId === "function") {
    watch(gameId, () => {
      refreshActions();
    });
  }

  return {
    actions,
    isLoading,
    refreshActions,
  };
}
