defineRouteMeta({
  openAPI: {
    tags: ["Health"],
    description: "Health check endpoint",
  },
});

export default defineEventHandler(() => {
  return {
    status: "ok",
    timestamp: Date.now(),
  };
});
