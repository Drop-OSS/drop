import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AppStatus } from "~/types";

export function setupHooks() {
  const router = useRouter();
  const state = useAppState();

  listen("auth/processing", (event) => {
    router.push("/auth/processing");
  });

  listen("auth/failed", (event) => {
    router.push(`/auth/failed?error=${encodeURIComponent(event.payload as string)}`);
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
      (e, c) => c(),
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
      },
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
