export default defineNitroPlugin(async (_nitro) => {
  // all tasks we should run on server boot
  await Promise.all([
    runTask("cleanup:invitations"),
    runTask("cleanup:sessions"),
    // TODO: maybe implement some sort of rate limit thing to prevent this from calling github api a bunch in the event of crashloop or whatever?
    // probably will require custom task scheduler for object cleanup anyway, so something to thing about
    runTask("check:update"),
  ]);
});
