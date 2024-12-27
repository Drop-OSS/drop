import { H3Error } from "h3";

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook("error", async (error, { event }) => {
    if (!event) return;

    // Don't handle for API routes
    if (event.path.startsWith("/api")) return;

    // Make sure it's a web error
    if (!(error instanceof H3Error)) return;

    switch (error.statusCode) {
      case 401:
      case 403:
        const userId = await event.context.session.getUserId(event);
        if (userId) break;
        console.log("user is signed out, redirecting");
        return sendRedirect(
          event,
          `/signin?redirect=${encodeURIComponent(event.path)}`
        );
    }
  });
});
