import { metadataHandler } from "~/server/plugins/metadata";

export default defineTask({
  meta: {
    name: "metadata:refreshCredentials",
    description: "Refresh credentials for metadata providers",
  },
  run({ payload, context }) {
    metadataHandler.refreshCredentials();
    return { result: "Success" };
  },
});
