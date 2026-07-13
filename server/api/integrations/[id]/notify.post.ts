import { getConnector } from "~~/server/connectors";
import { connectorIdParamsSchema } from "~~/server/schemas/integrations";
import { sendConnectionConfirmation } from "~~/server/utils/auth-delivery";
import { probeStatus } from "~~/server/utils/connect";
import { getPhoneLinkForAppUser } from "~~/server/utils/phone-links";
import { requireSessionUserId } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, connectorIdParamsSchema.parse);
  const connector = getConnector(id);
  const userId = await requireSessionUserId(event);
  const status = await probeStatus(connector, userId);

  if (status.state !== "connected") {
    throw createError({ statusCode: 409, statusMessage: `${connector.name} is not connected yet` });
  }

  const phone = await getPhoneLinkForAppUser(userId);
  if (!phone) {
    return { notified: false, reason: "no_verified_phone" };
  }

  await sendConnectionConfirmation(
    phone.phoneNumber,
    "GitHub",
  );
  return { notified: true };
});
