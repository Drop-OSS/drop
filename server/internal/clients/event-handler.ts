import { Client, User } from "@prisma/client";
import { EventHandlerRequest, H3Event } from "h3";
import droplet from "@drop/droplet";
import prisma from "../db/database";

export type EventHandlerFunction<T> = (
  h3: H3Event<EventHandlerRequest>,
  utils: ClientUtils,
) => Promise<T> | T;

type ClientUtils = {
  clientId: string;
  fetchClient: () => Promise<Client>;
  fetchUser: () => Promise<User>;
};

const NONCE_LENIENCE = 30_000;

export function defineClientEventHandler<T>(handler: EventHandlerFunction<T>) {
  return defineEventHandler(async (h3) => {
    const header = getHeader(h3, "Authorization");
    if (!header) throw createError({ statusCode: 403 });
    const [method, ...parts] = header.split(" ");

    let clientId: string;
    switch (method) {
      case "Nonce":
        clientId = parts[0];
        const nonce = parts[1];
        const signature = parts[2];

        if (!clientId || !nonce || !signature)
          throw createError({ statusCode: 403 });

        const nonceTime = parseInt(nonce);
        const current = Date.now();
        if (
          // If it was generated in the future
          nonceTime > current ||
          // Or more than thirty seconds ago
          nonceTime < current - NONCE_LENIENCE
        ) {
          // We reject the request
          throw createError({
            statusCode: 403,
            statusMessage: "Nonce expired",
          });
        }

        const ca = h3.context.ca;
        const certBundle = await ca.fetchClientCertificate(clientId);
        // This does the blacklist check already
        if (!certBundle)
          throw createError({
            statusCode: 403,
            statusMessage: "Invalid client ID",
          });

        const valid = droplet.verifyNonce(certBundle.cert, nonce, signature);
        if (!valid)
          throw createError({
            statusCode: 403,
            statusMessage: "Invalid nonce signature.",
          });
        break;
      default:
        throw createError({
          statusCode: 403,
          statusMessage: "No authentication",
        });
    }

    if (clientId === undefined)
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to execute authentication pipeline.",
      });

    async function fetchClient() {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });
      if (!client)
        throw new Error(
          "client util fetch client broke - this should NOT happen",
        );
      return client;
    }

    async function fetchUser() {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
          user: true,
        },
      });

      if (!client)
        throw new Error(
          "client util fetch client broke - this should NOT happen",
        );

      return client.user;
    }

    const utils: ClientUtils = {
      clientId,
      fetchClient,
      fetchUser,
    };

    return await handler(h3, utils);
  });
}
