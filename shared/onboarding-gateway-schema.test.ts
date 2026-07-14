import { describe, expect, it } from "vitest";
import { onboardingGatewayRequestSchema } from "./onboarding-gateway-schema";

describe("onboarding gateway request", () => {
  it("preserves a typed consent interaction across the channel boundary", () => {
    const request = onboardingGatewayRequestSchema.parse({
      interaction: { kind: "consent", value: "yes" },
      messageId: "spc-msg-poll-vote",
      phoneNumber: "+12362584910",
      text: "",
      threadId: "imessage:any;-;+12362584910~shared",
    });

    expect(request.interaction).toEqual({ kind: "consent", value: "yes" });
  });

  it("rejects unrecognized interaction values instead of silently stripping them", () => {
    expect(() => onboardingGatewayRequestSchema.parse({
      interaction: { kind: "consent", value: "maybe" },
      phoneNumber: "+12362584910",
      text: "",
      threadId: "imessage:any;-;+12362584910~shared",
    })).toThrow();
  });
});
