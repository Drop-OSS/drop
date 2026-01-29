import { type } from "arktype";
import { applicationSettings } from "~/server/internal/config/application-configuration";
import { readDropValidatedBody } from "~/server/arktype";
import { defineEventHandler, createError } from "h3";
import aclManager from "~/server/internal/acls";
import objectHandler from "~/server/internal/objects";
import type { Settings } from "~/server/internal/utils/types";

const UpdateSettings = type({
  "store?": {
    showGamePanelTextDecoration: "boolean",
  },
  "generalSettings?": {
    serverName: "string",
    mLogoObjectId: "string | null",
  },
});

export default defineEventHandler<{ body: typeof UpdateSettings.infer }>(
  async (h3): Promise<Settings> => {
    const allowed = await aclManager.allowSystemACL(h3, ["settings:update"]);
    if (!allowed) throw createError({ statusCode: 403 });

    const body = await readDropValidatedBody(h3, UpdateSettings);

    if (body.store) {
      await applicationSettings.set(
        "showGamePanelTextDecoration",
        body.store.showGamePanelTextDecoration,
      );
    }
    if (body.generalSettings) {
      const previousMLogoObjectId =
        await applicationSettings.get("mLogoObjectId");
      await applicationSettings.set(
        "serverName",
        body.generalSettings.serverName,
      );
      if (body.generalSettings.mLogoObjectId !== previousMLogoObjectId) {
        if (previousMLogoObjectId) {
          await objectHandler.deleteAsSystem(previousMLogoObjectId);
        }
        applicationSettings.set(
          "mLogoObjectId",
          body.generalSettings.mLogoObjectId || null,
        );
      }
    }
    return await applicationSettings.getSettings();
  },
);
