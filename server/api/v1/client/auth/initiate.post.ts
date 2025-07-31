import type {
  CapabilityConfiguration,
  InternalClientCapability,
} from "~/server/internal/clients/capabilities";
import capabilityManager, {
  validCapabilities,
} from "~/server/internal/clients/capabilities";
import clientHandler from "~/server/internal/clients/handler";
import { parsePlatform } from "~/server/internal/utils/parseplatform";

export default defineEventHandler(async (h3) => {
  const body = await readBody(h3);

  const name = body.name;
  const platformRaw = body.platform;
  const capabilities: Partial<CapabilityConfiguration> =
    body.capabilities ?? {};

  if (!name || !platformRaw)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing name or platform in body",
    });

  const platform = parsePlatform(platformRaw);
  if (!platform)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid or unsupported platform",
    });

  if (!capabilities || typeof capabilities !== "object")
    throw createError({
      statusCode: 400,
      statusMessage: "Capabilities must be an array",
    });

  const capabilityIterable = Object.entries(capabilities) as Array<
    [InternalClientCapability, object]
  >;
  if (
    capabilityIterable.length > 0 &&
    capabilityIterable
      .map(([capability]) => validCapabilities.find((v) => capability == v))
      .filter((e) => e).length == 0
  )
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid capabilities.",
    });

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

  const clientId = await clientHandler.initiate({
    name,
    platform,
    capabilities,
  });

  return `/client/${clientId}/callback`;
});
