import type {
  OnboardingGatewayRequest,
  OnboardingGatewayResponse,
} from "../../shared/types/onboarding.js";
import { appOrigin, internalHeaders } from "./internal-api.js";

export async function runOnboardingGateway(input: OnboardingGatewayRequest) {
  const response = await fetch(`${appOrigin()}/api/internal/onboarding/gateway`, {
    method: "POST",
    headers: internalHeaders(),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => "");
    throw new Error(`Onboarding gateway failed (${response.status})${reason ? `: ${reason}` : ""}`);
  }

  return await response.json() as OnboardingGatewayResponse;
}
