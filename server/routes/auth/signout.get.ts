import sessionHandler from "../../internal/session";

defineRouteMeta({
  openAPI: {
    tags: ["Auth"],
    description: "Tells server to deauthorize this session",
    parameters: [],
  },
});

export default defineEventHandler(async (h3) => {
  await sessionHandler.signout(h3);

  return sendRedirect(h3, "/auth/signin");
});
