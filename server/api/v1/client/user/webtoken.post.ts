import { APITokenMode } from "~/prisma/client/enums";
import { DateTime } from "luxon";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";
import { CLIENT_WEBTOKEN_ACLS } from "~/server/plugins/04.auth-init";

export default defineClientEventHandler(
  async (h3, { fetchUser, fetchClient, clientId }) => {
    const user = await fetchUser();
    const client = await fetchClient();

    const token = await prisma.aPIToken.create({
      data: {
        name: `${client.name} Web Access Token ${DateTime.now().toISO()}`,
        clientId,
        userId: user.id,
        mode: APITokenMode.Client,
        acls: CLIENT_WEBTOKEN_ACLS,
      },
    });

    return token.token;
  },
);
