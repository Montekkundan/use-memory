import { describe, expect, it } from "vitest";
import {
  createPhotonChannelRegistration,
  DisabledPhotonAdapter,
  hasPhotonCloudCredentials,
  hasPhotonWebhookCredentials,
  parsePhotonOnboardingPollVote,
  resolvePhotonConfiguration,
} from "./photon.js";

describe("Photon configuration", () => {
  it("accepts the Spectrum names shown in Photon Cloud", () => {
    const config = resolvePhotonConfiguration({
      SPECTRUM_PROJECT_ID: "project-id",
      SPECTRUM_PROJECT_SECRET: "project-secret",
      SPECTRUM_SIGNING_SECRET: "signing-secret",
    });

    expect(config).toEqual({
      projectId: "project-id",
      projectSecret: "project-secret",
      webhookSecret: "signing-secret",
    });
    expect(hasPhotonCloudCredentials(config)).toBe(true);
    expect(hasPhotonWebhookCredentials(config)).toBe(true);
  });

  it("prefers the documented iMessage adapter names when both are present", () => {
    expect(resolvePhotonConfiguration({
      IMESSAGE_PROJECT_ID: "imessage-id",
      IMESSAGE_PROJECT_SECRET: "imessage-secret",
      IMESSAGE_WEBHOOK_SECRET: "imessage-webhook",
      SPECTRUM_PROJECT_ID: "spectrum-id",
      SPECTRUM_PROJECT_SECRET: "spectrum-secret",
      SPECTRUM_SIGNING_SECRET: "spectrum-webhook",
    })).toEqual({
      projectId: "imessage-id",
      projectSecret: "imessage-secret",
      webhookSecret: "imessage-webhook",
    });
  });

  it("allows outbound delivery with project credentials while requiring the signing secret for webhooks", () => {
    const config = resolvePhotonConfiguration({
      SPECTRUM_PROJECT_ID: "project-id",
      SPECTRUM_PROJECT_SECRET: "project-secret",
    });

    expect(hasPhotonCloudCredentials(config)).toBe(true);
    expect(hasPhotonWebhookCredentials(config)).toBe(false);
  });
});

describe("DisabledPhotonAdapter", () => {
  it("registers the adapter under the name Chat SDK persists for resumed replies", () => {
    const adapter = new DisabledPhotonAdapter();
    const registration = createPhotonChannelRegistration(adapter);

    expect(adapter.name).toBe("imessage");
    expect(Object.keys(registration.adapters)).toEqual([adapter.name]);
    expect(registration.adapters[adapter.name]).toBe(adapter);
    expect(registration.routes[adapter.name]).toBe("/eve/v1/photon");
  });

  it("does not initialize a remote Photon client", async () => {
    const adapter = new DisabledPhotonAdapter();

    await expect(adapter.initialize()).resolves.toBeUndefined();
    expect(adapter.app).toBeNull();
  });

  it("returns a service-unavailable response for webhooks", async () => {
    const adapter = new DisabledPhotonAdapter();
    const response = await adapter.handleWebhook(
      new Request("https://use-memory.test/eve/v1/photon", { method: "POST" }),
    );

    expect(response.status).toBe(503);
    await expect(response.text()).resolves.toBe("Photon Cloud is not configured");
  });
});

describe("parsePhotonOnboardingPollVote", () => {
  it("turns a selected onboarding poll option into gateway input", () => {
    expect(parsePhotonOnboardingPollVote({
      content: {
        type: "poll_option",
        selected: true,
        poll: { title: "Set up use-memory? abc123" },
        option: { title: "Yes, continue" },
      },
    })).toBe("yes");

    expect(parsePhotonOnboardingPollVote({
      content: {
        type: "poll_option",
        selected: true,
        poll: { title: "Set up use-memory? abc123" },
        option: { title: "No, stop" },
      },
    })).toBe("no");
  });

  it("ignores deselection and unrelated polls", () => {
    expect(parsePhotonOnboardingPollVote({
      content: {
        type: "poll_option",
        selected: false,
        poll: { title: "Set up use-memory? abc123" },
        option: { title: "Yes, continue" },
      },
    })).toBeNull();

    expect(parsePhotonOnboardingPollVote({
      content: {
        type: "poll_option",
        selected: true,
        poll: { title: "Lunch?" },
        option: { title: "Yes, continue" },
      },
    })).toBeNull();
  });

  it("distinguishes ordinary messages from ignored poll events", () => {
    expect(parsePhotonOnboardingPollVote({
      content: { type: "text", text: "hello" },
    })).toBeUndefined();

    expect(parsePhotonOnboardingPollVote(undefined)).toBeUndefined();
  });
});
