import { H3Error } from "h3";
import sessionHandler from "../internal/session";

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook("error", async (error, { event }) => {
    if (!event) return;

    // Don't handle for API routes
    if (event.path.startsWith("/api")) return;
    if (event.path.startsWith("/auth")) return;

    // Make sure it's a web error
    if (!(error instanceof H3Error)) return;

    switch (error.statusCode) {
      case 401:
      case 403: {
        const user = await sessionHandler.getSession(event);
        if (user) break;
        return sendRedirect(
          event,
          `/auth/signin?redirect=${encodeURIComponent(event.path)}`,
        );
      }
    }
  });
});
