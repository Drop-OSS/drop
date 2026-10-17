import { type } from "arktype";
import { ClientCapabilities } from "~/prisma/client/enums";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";

const maxElapsedSeconds = 31536000;
const PlaytimeBody = type({
  seconds: "number.integer",
}).configure(throwingArktype);

export default defineClientEventHandler(
  async (h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    if (!client.capabilities.includes(ClientCapabilities.TrackPlaytime))
      throw createError({
        statusCode: 403,
        statusMessage: "Capability not allowed.",
      });
    const user = await fetchUser();
    const gameId = getRouterParam(h3, "gameid");
    if (!gameId)
      throw createError({
        statusCode: 400,
        statusMessage: "No gameID in route params",
      });

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true },
    });
    if (!game)
      throw createError({ statusCode: 400, statusMessage: "Invalid game ID" });

    const body = await readDropValidatedBody(h3, PlaytimeBody);
    const elapsedSeconds = body.seconds;
    if (elapsedSeconds <= 0 || elapsedSeconds > maxElapsedSeconds)
      throw createError({
        statusCode: 400,
        statusMessage: `seconds must be between 1 and ${maxElapsedSeconds}.`,
      });

    return prisma.playtime.upsert({
      where: {
        gameId_userId: {
          gameId,
          userId: user.id,
        },
      },
      create: {
        gameId,
        userId: user.id,
        seconds: elapsedSeconds,
      },
      update: {
        seconds: { increment: elapsedSeconds },
      },
    });
  },
);
