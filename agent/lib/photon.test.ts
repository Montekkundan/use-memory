import { describe, expect, it } from "vitest";
import {
  DisabledPhotonAdapter,
  hasPhotonCloudCredentials,
  hasPhotonWebhookCredentials,
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
