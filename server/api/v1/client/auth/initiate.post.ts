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

/**
 * Client route to initiate authorization flow.
 * @response The requested callback or code.
 */
export default defineEventHandler<{ body: typeof ClientAuthInitiate.infer }>(
  async (h3) => {
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

    const result = await clientHandler.initiate({
      name: body.name,
      platform,
      capabilities,
      mode: body.mode,
    });

    return result;
  },
);
