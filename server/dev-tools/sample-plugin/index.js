/**
 * Minimal external Drop plugin. Install by copying this directory to
 * `<dataDir>/plugins/sample-plugin/`, then sign it with
 * `node dev-tools/sign-plugin.mjs dev-tools/sample-plugin`.
 */
export default {
  metadata: {
    id: "sample-plugin",
    name: "Sample Plugin",
    version: "1.0.0",
    capabilities: ["routes"],
  },
  init(ctx) {
    ctx.registerRoute("GET", "/hello", () => ({ hello: "world" }));
  },
};
