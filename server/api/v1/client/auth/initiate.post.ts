import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import type {
  CapabilityConfiguration,
  InternalClientCapability,
} from "~/server/internal/clients/capabilities";
import capabilityManager, {
  validCapabilities,
} from "~/server/internal/clients/capabilities";
import clientHandler, { AuthMode } from "~/server/internal/clients/handler";
import { parsePlatform } from "~/server/internal/utils/parseplatform";

const ClientAuthInitiate = type({
  name: "string",
  platform: "string",
  capabilities: "object",
  mode: type.valueOf(AuthMode).default(AuthMode.Callback),
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const body = await readDropValidatedBody(h3, ClientAuthInitiate);

  const platformRaw = body.platform;
  const capabilities: Partial<CapabilityConfiguration> =
    body.capabilities ?? {};

  const platform = parsePlatform(platformRaw);
  if (!platform)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid or unsupported platform",
    });

  const capabilityIterableRaw = Object.entries(capabilities);
  const capabilityIterable = capabilityIterableRaw.map(
    ([capability, value]) => {
      const actualCapability = validCapabilities.find(
        (v) => capability.toLowerCase() == v.toLowerCase(),
      );
      if (!actualCapability)
        throw createError({
          statusCode: 400,
          message: "Invalid capabilities.",
        });
      return [actualCapability, value];
    },
  ) as Array<[InternalClientCapability, object]>;

  if (
    capabilityIterable.length > 0 &&
    capabilityIterable.filter(
      ([capability, configuration]) =>
        !capabilityManager.validateCapabilityConfiguration(
          capability,
          configuration,
        ),
    ).length > 0
  )
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid capability configuration.",
    });

  const result = await clientHandler.initiate({
    name: body.name,
    platform,
    capabilities: Object.fromEntries(capabilityIterable),
    mode: body.mode,
  });

  return result;
});
