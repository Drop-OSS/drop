import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  Game,
  GameStatus,
  GameStatusEnum,
  GameVersion,
  RawGameStatus,
} from "~/types";

const gameRegistry: { [key: string]: { game: Game; version: Ref<GameVersion | undefined> } } =
  {};

const gameStatusRegistry: { [key: string]: Ref<GameStatus> } = {};

export const parseStatus = (status: RawGameStatus): GameStatus => {
  if (status[0]) {
    return status[0];
  }
  if (status[1]) {
    return status[1];
  }
  throw new Error("No game status: " + JSON.stringify(status));
};

export const useGame = async (gameId: string) => {
  if (!gameRegistry[gameId]) {
    const data: {
      game: Game;
      status: RawGameStatus;
      version?: GameVersion;
    } = await invoke("fetch_game", {
      gameId,
    });
    const entry = { game: data.game, version: ref(data.version) };
    gameRegistry[gameId] = entry;
    if (!gameStatusRegistry[gameId]) {
      const statusRef = ref(parseStatus(data.status));
      gameStatusRegistry[gameId] = statusRef;

      listen(`update_game/${gameId}`, (event) => {
        const payload: {
          status: RawGameStatus;
          version?: GameVersion;
        } = event.payload as any;
        statusRef.value = parseStatus(payload.status);

        /**
         * I am not super happy about this.
         *
         * This will mean that we will still have a version assigned if we have a game installed then uninstall it.
         * It is necessary because a flag to check if we should overwrite seems excessive, and this function gets called
         * on transient state updates.
         */
        if (payload.version) {
          entry.version.value = payload.version;
        }
      });
    }
  }

  const game = gameRegistry[gameId]!;
  const status = gameStatusRegistry[gameId]!;
  return { ...game, status };
};

export type LaunchResult =
  | { result: "Success" }
  | { result: "InstallRequired"; data: [string, string] };

export type VersionOption = {
  versionId: string;
  displayName?: string;
  versionPath: string;
  platform: string;
  size: {
    installSize: number;
    downloadSize: number;
  };
  requiredContent: Array<{
    gameId: string;
    versionId: string;
    name: string;
    iconObjectId: string;
    shortDescription: string;
    size: {
      installSize: number;
      downloadSize: number;
    };
  }>;
};

export type ProtonPath = {
  path: string;
  name: string;
};
