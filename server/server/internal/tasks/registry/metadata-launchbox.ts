import { MetadataSource } from "~/prisma/client/enums";
import { defineDropTask, type TaskRunContext } from "..";
import metadataHandler from "../../metadata";
import { LaunchBoxProvider } from "../../metadata/launchbox";

export default defineDropTask({
  buildId: () => `metadata:launchbox-index:${new Date().toISOString()}`,
  name: "Rebuild LaunchBox index",
  acls: ["system:maintenance:read"],
  taskGroup: "metadata:launchbox-index",
  async run(context: TaskRunContext) {
    const provider = metadataHandler.getProvider(MetadataSource.LaunchBox);
    if (!(provider instanceof LaunchBoxProvider)) {
      throw new Error("The LaunchBox metadata provider is not enabled");
    }

    context.logger.info("Rebuilding the LaunchBox index");
    const index = await provider.rebuild(context);
    if (!index)
      throw new Error(
        "No launchboxIndexDir is configured, so there is no index to rebuild",
      );

    context.logger.info(
      `LaunchBox index built at ${index.builtAt} with ${Object.keys(index.games).length} games`,
    );
    context.progress(100);
  },
});
