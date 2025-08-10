/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ClientModel, UserModel } from "~/prisma/client/models";
import type { EventHandlerResolver, EventHandlerResponse, H3Event } from "h3";
import droplet from "@drop-oss/droplet";
import prisma from "../db/database";
import { useCertificateAuthority } from "~/server/plugins/ca";
import type { Type } from "arktype";
import { readDropValidatedBody } from "~/server/arktype";

type ClientUtils<R> = {
  body: R;
  clientId: string;
  fetchClient: () => Promise<ClientModel>;
  fetchUser: () => Promise<UserModel>;
};

const NONCE_LENIENCE = 30_000;

type ClientEventHandlerRequest<T, Q = {[key: string]: any }> = {
  body?: T;
  query?: Q;
};

interface ClientEventHandler<
  R = any,
  Request extends ClientEventHandlerRequest<R> = ClientEventHandlerRequest<R>,
  Response extends EventHandlerResponse = EventHandlerResponse,
> {
  __is_handler__?: true;
  __resolve__?: EventHandlerResolver;
  (event: H3Event<Request>, utils: ClientUtils<R>): Response;
}

export function defineClientEventHandler<
  R = any,
  T extends ClientEventHandlerRequest<R> = ClientEventHandlerRequest<R>,
  K extends EventHandlerResponse = EventHandlerResponse,
>(handler: ClientEventHandler<R, T, K>, validator?: Type<R>) {
  return defineEventHandler(async (h3) => {
    const header = getHeader(h3, "Authorization");
    if (!header) throw createError({ statusCode: 403 });
    const [method, ...parts] = header.split(" ");

    let clientId: string;
    switch (method) {
      case "Debug": {
        if (!import.meta.dev) throw createError({ statusCode: 403 });
        const client = await prisma.client.findFirst({ select: { id: true } });
        if (!client)
          throw createError({
            statusCode: 400,
            statusMessage: "No clients created.",
          });
        clientId = client.id;
        break;
      }
      case "Nonce": {
        clientId = parts[0];
        const nonce = parts[1];
        const signature = parts[2];

        if (!clientId || !nonce || !signature)
          throw createError({ statusCode: 403 });

        const nonceTime = parseInt(nonce);
        const current = Date.now();
        if (
          // If it "will be generated" in thirty seconds
          nonceTime > current + NONCE_LENIENCE ||
          // Or more than thirty seconds ago
          nonceTime < current - NONCE_LENIENCE
        ) {
          // We reject the request
          throw createError({
            statusCode: 403,
            statusMessage: "Nonce expired",
          });
        }

        const certificateAuthority = useCertificateAuthority();
        const certBundle =
          await certificateAuthority.fetchClientCertificate(clientId);
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
      }
      default: {
        throw createError({
          statusCode: 403,
          statusMessage: "No authentication",
        });
      }
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

    const utils: ClientUtils<unknown> = {
      clientId,
      fetchClient,
      fetchUser,
      body: undefined,
    };

    await prisma.client.update({
      where: { id: clientId },
      data: { lastConnected: new Date() },
    });

    const body = validator
      ? await readDropValidatedBody(h3, validator)
      : undefined;

    return await handler(h3, { ...utils, body: body as R });
  });
}
