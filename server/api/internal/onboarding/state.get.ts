import { z } from "zod";
import { getOnboardingSnapshot } from "~~/server/utils/onboarding";
import { requireInternalRequest } from "~~/server/utils/internal-api";

const querySchema = z.object({ phoneNumber: z.string().trim().min(1) });

export default defineEventHandler(async (event) => {
  requireInternalRequest(event);
  const { phoneNumber } = await getValidatedQuery(event, querySchema.parse);
  return { onboarding: await getOnboardingSnapshot(phoneNumber) };
});
