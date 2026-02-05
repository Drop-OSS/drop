import prisma from "../../db/database";
import { ServerGamesResponseSchema } from "../../proto/torrential/proto/manifest_pb";
import { create } from "@bufbuild/protobuf";
import { defineQueryProcessor } from "./utils";
import {
  DropBoundType,
  TorrentialBoundType,
} from "../../proto/torrential/proto/core_pb";

export default defineQueryProcessor({
  queryType: DropBoundType.SERVER_GAMES_QUERY,
  run: async () => {
    // const queryData = fromBinary(ServerGamesQuerySchema, query.data);
    const games = await prisma.game.findMany({
      select: {
        id: true,
        versions: {
          select: {
            versionId: true,
          },
          where: {
            versionPath: {
              not: null,
            },
          },
        },
      },
    });

    return {
      type: TorrentialBoundType.SERVER_GAMES_RESPONSE,
      schema: ServerGamesResponseSchema,
      data: create(ServerGamesResponseSchema, {
        games,
      }),
    };
  },
});
