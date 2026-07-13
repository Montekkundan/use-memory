import { z } from "zod";
import { setAutomaticMemoryConsent } from "~~/server/utils/mem0";
import { requireSessionUserId } from "~~/server/utils/session";

const settingsBodySchema = z.object({
  enabled: z.boolean(),
});

export default defineEventHandler(async (event) => {
  const userId = await requireSessionUserId(event);
  const body = await readValidatedBody(event, settingsBodySchema.parse);
  const settings = await setAutomaticMemoryConsent(userId, body.enabled);
  return { settings };
});
