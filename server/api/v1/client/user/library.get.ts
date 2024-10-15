import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";

export default defineClientEventHandler(async (h3) => {
    // TODO return the user's library
    const games = await prisma.game.findMany({});
    return games;
});