import { type } from "arktype";
import { ClientCapabilities } from "~~/prisma/client/enums";
import { readDropValidatedBody, throwingArktype } from "~~/server/arktype";
import capabilityManager from "~~/server/internal/clients/capabilities";
import { defineClientEventHandler } from "~~/server/internal/clients/event-handler";
import notificationSystem from "~~/server/internal/notifications";

const SetCapability = type({
  capability: type.enumerated(...Object.values(ClientCapabilities)),
  configuration: "object"
}).configure(throwingArktype);

export default defineClientEventHandler(
  async (h3, { clientId, fetchClient, fetchUser }) => {
    const body = await readDropValidatedBody(h3, SetCapability);

    const isValid = await capabilityManager.validateCapabilityConfiguration(
      body.capability,
      body.configuration,
    );
    if (!isValid)
      throw createError({
        statusCode: 400,
        message: "Invalid capability configuration.",
      });

    await capabilityManager.upsertClientCapability(
      body.capability,
      body.configuration,
      clientId,
    );

    const client = await fetchClient();
    const user = await fetchUser();

    await notificationSystem.push(user.id, {
      nonce: `capability-${clientId}-${body.capability}`,
      title: `"${client.name}" can now access ${body.capability}`,
      description: `A device called "${client.name}" now has access to your ${body.capability}.`,
      actions: ["Review|/account/devices"],
      acls: ["user:clients:read"],
    });

    return {};
  },
);
