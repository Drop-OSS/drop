import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { data } from "autoprefixer";
import type { SaveSyncOutcome } from "~/composables/saves";
import { AppStatus, type AppState } from "~/types";

export function setupHooks() {
  const router = useRouter();
  const state = useAppState();

  listen("auth/processing", (event) => {
    router.push("/auth/processing");
  });

  listen("auth/failed", (event) => {
    router.push(
      `/auth/failed?error=${encodeURIComponent(event.payload as string)}`
    );
  });

  listen("auth/finished", async (event) => {
    router.push("/library");
    state.value = JSON.parse(await invoke("fetch_state"));
  });

  listen("download_error", (event) => {
    createModal(
      ModalType.Notification,
      {
        title: "Drop encountered an error while downloading",
        description: `Drop encountered an error while downloading your game: "${(
          event.payload as unknown as string
        ).toString()}"`,
        buttonText: "Close",
      },
      (e, c) => c()
    );
  });

  // This is for errors that (we think) aren't our fault
  listen("launch_external_error", (event) => {
    createModal(
      ModalType.Confirmation,
      {
        title: "Did something go wrong?",
        description:
          "Drop detected that something might've gone wrong with launching your game. Do you want to open the log directory?",
        buttonText: "Open",
      },
      async (e, c) => {
        if (e == "confirm") {
          await invoke("open_process_logs", { gameId: event.payload });
        }
        c();
      }
    );
  });

  // Cloud saves v1 always asks: a conflict (usually noticed when the game
  // just exited) needs the user, wherever they are in the app. Record it on
  // the per-game saves registry first, so the game page's own conflict
  // dialog is already open when they arrive; only prompt from here when
  // that page is not the one they are looking at.
  listen("saves_state", (event) => {
    const payload = event.payload as {
      gameId: string;
      slot: number;
      outcome: SaveSyncOutcome;
    };
    if (payload.outcome.kind !== "conflict") return;
    useSaves(payload.gameId).outcome.value = payload.outcome;
    if (router.currentRoute.value.path === `/library/${payload.gameId}`) return;
    createModal(
      ModalType.Confirmation,
      {
        title: "Cloud save conflict",
        description:
          "This device and the server each changed a game's save since the last sync. Nothing was overwritten - review the versions and choose which to keep.",
        buttonText: "Review",
      },
      async (e, c) => {
        if (e == "confirm") {
          router.push(`/library/${payload.gameId}`);
        }
        c();
      }
    );
  });

  /*

  document.addEventListener("contextmenu", (event) => {
    event.target?.dispatchEvent(new Event("contextmenu"));
    event.preventDefault();
  });

  */
}

export function initialNavigation(state: ReturnType<typeof useAppState>) {
  if (!state.value)
    throw createError({
      statusCode: 500,
      statusMessage: "App state not valid",
      fatal: true,
    });
  const router = useRouter();

  switch (state.value.status) {
    case AppStatus.NotConfigured:
      router.push({ path: "/setup" });
      break;
    case AppStatus.SignedOut:
      router.push("/auth");
      break;
    case AppStatus.SignedInNeedsReauth:
      router.push("/auth/signedout");
      break;
    case AppStatus.ServerUnavailable:
      router.push("/error/serverunavailable");
      break;
    default:
      router.push("/library");
  }
}
