export default defineEventHandler(async () => {
  await new Promise((r) => setTimeout(r, 1400));
});
