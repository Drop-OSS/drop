import capabilityManager, {
  InternalClientCapability,
  validCapabilities,
} from "~/server/internal/clients/capabilities";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";

export default defineClientEventHandler(async (h3, { clientId }) => {
  const body = await readBody(h3);
  const rawCapability = body.capability;
  const configuration = body.configuration;

  if (!rawCapability || typeof rawCapability !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "capability must be a string",
    });

  if (!configuration || typeof configuration !== "object")
    throw createError({
      statusCode: 400,
      statusMessage: "configuration must be an object",
    });

  if (!(rawCapability in validCapabilities))
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid capability.",
    });

  const capability = rawCapability as InternalClientCapability;

  const isValid = await capabilityManager.validateCapabilityConfiguration(
    capability,
    configuration
  );
  if (!isValid)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid capability configuration.",
    });

  await capabilityManager.upsertClientCapability(
    capability,
    configuration,
    clientId
  );

  return {};
});
