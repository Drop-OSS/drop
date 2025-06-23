import { type } from "arktype";
import { applicationSettings } from "~/server/internal/config/application-configuration";
import { readDropValidatedBody } from "~/server/arktype";
import { defineEventHandler, createError } from "h3";
import aclManager from "~/server/internal/acls";

const UpdateSettings = type({
  showTitleDescriptionOnGamePanel: "boolean",
});

export default defineEventHandler<{ body: typeof UpdateSettings.infer }>(
  async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, ["settings:update"]);
    if (!allowed) throw createError({ statusCode: 403 });

    const body = await readDropValidatedBody(h3, UpdateSettings);

    await applicationSettings.set(
      "showTitleDescriptionOnGamePanel",
      body.showTitleDescriptionOnGamePanel,
    );
  },
);
