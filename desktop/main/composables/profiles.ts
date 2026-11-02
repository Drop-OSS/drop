import { invoke } from "@tauri-apps/api/core";

/** The server's profile DTO (`ProfileDto` on both sides of the wire). */
export interface Profile {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
}

const profiles = useState<Profile[]>("profiles", () => []);
const currentProfileId = useState<string | null>(
  "current-profile-id",
  () => null,
);

/**
 * The account's players, and which one this device plays as. State lives in
 * `useState` so the header switcher and the settings page always agree.
 * "No id chosen" (a fresh install) means the server's default player.
 */
export const useProfiles = () => {
  const refresh = async () => {
    try {
      profiles.value = await invoke<Profile[]>("fetch_profiles");
      currentProfileId.value = await invoke<string | null>(
        "get_current_profile",
      );
    } catch (e) {
      // Server unreachable: keep the last known roster.
      console.warn("profile refresh failed:", e);
    }
  };

  /** Play as `id`: persist the choice, then refetch the library, whose rows
   * embed this player's stats (the cache was cleared desktop-side). */
  const setActive = async (id: string) => {
    currentProfileId.value = await invoke<string | null>("set_current_profile", {
      profileId: id,
    });
    await invoke("fetch_library", { hardRefresh: true });
  };

  /** The player actually in effect; a never-switched install shows the
   * account's default. */
  const activeId = computed(
    () =>
      currentProfileId.value ??
      profiles.value.find((p) => p.isDefault)?.id ??
      null,
  );
  const activeName = computed(
    () => profiles.value.find((p) => p.id === activeId.value)?.name ?? null,
  );

  const createProfile = async (name: string) => {
    await invoke<Profile>("create_profile", { name });
    await refresh();
  };

  const renameProfile = async (id: string, name: string) => {
    await invoke<Profile>("rename_profile", { id, name });
    await refresh();
  };

  return {
    profiles,
    currentProfileId,
    activeId,
    activeName,
    refresh,
    setActive,
    createProfile,
    renameProfile,
  };
};
