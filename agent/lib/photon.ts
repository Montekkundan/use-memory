import { createMemoryState } from "@chat-adapter/state-memory";
import { createRedisState } from "@chat-adapter/state-redis";
import {
  createiMessageAdapter,
  iMessageAdapter,
} from "@photon-ai/chat-adapter-imessage";
import { ConsoleLogger } from "chat";

interface PhotonEnvironment {
  IMESSAGE_PROJECT_ID?: string;
  IMESSAGE_PROJECT_SECRET?: string;
  IMESSAGE_WEBHOOK_SECRET?: string;
  SPECTRUM_PROJECT_ID?: string;
  SPECTRUM_PROJECT_SECRET?: string;
  SPECTRUM_SIGNING_SECRET?: string;
}

export interface PhotonConfiguration {
  projectId?: string;
  projectSecret?: string;
  webhookSecret?: string;
}

export function createPhotonChannelRegistration<
  TAdapter extends { readonly name: string },
>(adapter: TAdapter) {
  return {
    adapters: { [adapter.name]: adapter },
    routes: { [adapter.name]: "/eve/v1/photon" },
  };
}

function optionalValue(value: string | undefined) {
  return value?.trim() || undefined;
}

export function resolvePhotonConfiguration(env: PhotonEnvironment): PhotonConfiguration {
  return {
    projectId: optionalValue(env.IMESSAGE_PROJECT_ID) || optionalValue(env.SPECTRUM_PROJECT_ID),
    projectSecret: optionalValue(env.IMESSAGE_PROJECT_SECRET) || optionalValue(env.SPECTRUM_PROJECT_SECRET),
    webhookSecret: optionalValue(env.IMESSAGE_WEBHOOK_SECRET) || optionalValue(env.SPECTRUM_SIGNING_SECRET),
  };
}

export function hasPhotonCloudCredentials(config: PhotonConfiguration) {
  return Boolean(config.projectId && config.projectSecret);
}

export function hasPhotonWebhookCredentials(config: PhotonConfiguration) {
  return hasPhotonCloudCredentials(config) && Boolean(config.webhookSecret);
}

const photonConfiguration = resolvePhotonConfiguration(process.env);

export function isPhotonCloudConfigured() {
  return hasPhotonCloudCredentials(photonConfiguration);
}

export function isPhotonWebhookConfigured() {
  return hasPhotonWebhookCredentials(photonConfiguration);
}

/**
 * Chat SDK initializes every adapter before dispatching a webhook. Using fake
 * Photon credentials here would make an unconfigured deployment contact
 * Spectrum Cloud during cold start and fail with a 500. This inert adapter
 * keeps the route explicit and returns a useful service-unavailable response
 * until the operator adds the real Photon Cloud credentials.
 */
export class DisabledPhotonAdapter extends iMessageAdapter {
  constructor() {
    super({
      local: false,
      logger: new ConsoleLogger("warn"),
    });
  }

  override async initialize(): Promise<void> {}

  override async handleWebhook(): Promise<Response> {
    return new Response("Photon Cloud is not configured", { status: 503 });
  }
}

export const photonAdapter = isPhotonCloudConfigured()
  ? createiMessageAdapter({
      local: false,
      projectId: photonConfiguration.projectId,
      projectSecret: photonConfiguration.projectSecret,
      webhookSecret: photonConfiguration.webhookSecret,
    })
  : new DisabledPhotonAdapter();

const redisUrl = process.env.REDIS_URL?.trim() || process.env.KV_URL?.trim();

export const photonState = process.env.NODE_ENV === "production" && redisUrl
  ? createRedisState({
      keyPrefix: "use-memory:chat-sdk",
      url: redisUrl,
    })
  : createMemoryState();

if (process.env.NODE_ENV === "production" && !redisUrl) {
  console.warn("[photon] REDIS_URL or KV_URL is required for durable production Chat SDK state");
}

if (!isPhotonCloudConfigured()) {
  console.warn("[photon] Outbound delivery is disabled until Photon project credentials are configured");
}
else if (!isPhotonWebhookConfigured()) {
  console.warn("[photon] Outbound delivery is enabled, but inbound webhooks are disabled until the Photon signing secret is configured");
}
