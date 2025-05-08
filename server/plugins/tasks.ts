export default defineNitroPlugin(async (_nitro) => {
  // all tasks we should run on server boot
  await Promise.all([
    runTask("cleanup:invitations"),
    runTask("cleanup:sessions"),
  ]);
});
