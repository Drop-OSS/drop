import { Client, User } from "@prisma/client";
import { EventHandlerRequest, H3Event } from "h3";
import droplet from "@drop/droplet";
import { useGlobalCertificateAuthority } from "~/server/plugins/ca";
import prisma from "../db/database";

export type EventHandlerFunction<T> = (
  h3: H3Event<EventHandlerRequest>,
  utils: ClientUtils
) => Promise<T> | T;

type ClientUtils = {
  clientId: string;
  fetchClient: () => Promise<Client>;
  fetchUser: () => Promise<User>;
};

export function defineClientEventHandler<T>(handler: EventHandlerFunction<T>) {
  return defineEventHandler(async (h3) => {
    const header = await getHeader(h3, "Authorization");
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

        const ca = useGlobalCertificateAuthority();
        const certBundle = await ca.fetchClientCertificate(clientId);
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
          "client util fetch client broke - this should NOT happen"
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
          "client util fetch client broke - this should NOT happen"
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