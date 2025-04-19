import { APITokenMode } from "@prisma/client";
import { DateTime } from "luxon";
import type { UserACL } from "~/server/internal/acls";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";

export default defineClientEventHandler(
  async (h3, { fetchUser, fetchClient, clientId }) => {
    const user = await fetchUser();
    const client = await fetchClient();

    const acls: UserACL = [
      "read",
      "store:read",
      "collections:read",
      "object:read",
    ];

    const token = await prisma.aPIToken.create({
      data: {
        name: `${client.name} Web Access Token ${DateTime.now().toISO()}`,
        clientId,
        userId: user.id,
        mode: APITokenMode.Client,
        acls,
      },
    });

    return token.token;
  },
);
