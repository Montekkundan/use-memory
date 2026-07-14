import { onboardingGatewayRequestSchema } from "#shared/onboarding-gateway-schema";
import { handleOnboardingGateway } from "~~/server/utils/onboarding";
import { requireInternalRequest } from "~~/server/utils/internal-api";

export default defineEventHandler(async (event) => {
  requireInternalRequest(event);
  const body = await readValidatedBody(event, onboardingGatewayRequestSchema.parse);
  return handleOnboardingGateway(body);
});
