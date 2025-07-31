import type { InternalClientCapability } from "~/server/internal/clients/capabilities";
import capabilityManager, {
  validCapabilities,
} from "~/server/internal/clients/capabilities";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import notificationSystem from "~/server/internal/notifications";

export default defineClientEventHandler(
  async (h3, { clientId, fetchClient, fetchUser }) => {
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

    const capability = rawCapability as InternalClientCapability;

    if (!validCapabilities.includes(capability))
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid capability.",
      });

    const isValid = await capabilityManager.validateCapabilityConfiguration(
      capability,
      configuration,
    );
    if (!isValid)
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid capability configuration.",
      });

    await capabilityManager.upsertClientCapability(
      capability,
      configuration,
      clientId,
    );

    const client = await fetchClient();
    const user = await fetchUser();

    await notificationSystem.push(user.id, {
      nonce: `capability-${clientId}-${capability}`,
      title: `"${client.name}" can now access ${capability}`,
      description: `A device called "${client.name}" now has access to your ${capability}.`,
      actions: ["Review|/account/devices"],
      acls: ["user:clients:read"],
    });

    return {};
  },
);
