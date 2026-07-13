import { defineChannel, POST } from "eve/channels";
import { agent } from "../../shared/agent.js";
import {
  createRequestId,
  errorCode,
  errorKind,
  logEvent,
  opaqueReference,
  safeErrorMessage,
} from "../../shared/observability.js";
import { isPhotonCloudConfigured, photonAdapter } from "../lib/photon.js";

interface PhotonAuthState extends Record<string, never> {}

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
}

export default defineChannel<PhotonAuthState>({
  kindHint: "photon-auth",
  state: {},
  routes: [
    POST("/eve/v1/auth/phone-otp", async (request) => {
      const secret = process.env.INTERNAL_API_SECRET?.trim();
      if (!secret) return json(503, { delivered: false, error: "Internal delivery is not configured" });
      if (request.headers.get("authorization") !== `Bearer ${secret}`) {
        return json(401, { delivered: false, error: "Unauthorized" });
      }
      if (!isPhotonCloudConfigured()) {
        return json(503, { delivered: false, error: "Photon Cloud is not configured" });
      }

      let body: unknown;
      try {
        body = await request.json();
      }
      catch {
        return json(400, { delivered: false, error: "Invalid JSON" });
      }

      const phoneNumber = body && typeof body === "object" && "phoneNumber" in body
        ? String(body.phoneNumber).trim()
        : "";
      const code = body && typeof body === "object" && "code" in body
        ? String(body.code).trim()
        : "";

      if (!/^\+[1-9]\d{7,14}$/u.test(phoneNumber) || !/^\d{6}$/u.test(code)) {
        return json(400, { delivered: false, error: "Expected an E.164 phoneNumber and six-digit code" });
      }

      try {
        const threadId = await photonAdapter.openDM(phoneNumber);
        await photonAdapter.postMessage(
          threadId,
          `${agent.name} verification code: ${code}\n\nThis code expires soon. Do not share it.`,
        );
        return json(200, { delivered: true });
      }
      catch (error) {
        logEvent("error", "photon.phone_otp.failed", {
          requestId: createRequestId(request.headers.get("x-request-id")),
          phoneRef: opaqueReference(phoneNumber),
          errorKind: errorKind(error),
          errorCode: errorCode(error),
          errorMessage: safeErrorMessage(error, [
            phoneNumber,
            code,
            process.env.SPECTRUM_PROJECT_SECRET ?? "",
            process.env.IMESSAGE_PROJECT_SECRET ?? "",
          ]),
        });
        return json(502, { delivered: false, error: "Delivery failed" });
      }
    }),
    POST("/eve/v1/system/connection-confirmed", async (request) => {
      const secret = process.env.INTERNAL_API_SECRET?.trim();
      if (!secret) return json(503, { delivered: false, error: "Internal delivery is not configured" });
      if (request.headers.get("authorization") !== `Bearer ${secret}`) {
        return json(401, { delivered: false, error: "Unauthorized" });
      }
      if (!isPhotonCloudConfigured()) {
        return json(503, { delivered: false, error: "Photon Cloud is not configured" });
      }

      let body: unknown;
      try {
        body = await request.json();
      }
      catch {
        return json(400, { delivered: false, error: "Invalid JSON" });
      }

      const phoneNumber = body && typeof body === "object" && "phoneNumber" in body
        ? String(body.phoneNumber).trim()
        : "";
      const connector = body && typeof body === "object" && "connector" in body
        ? String(body.connector).trim()
        : "";

      if (!/^\+[1-9]\d{7,14}$/u.test(phoneNumber) || !["GitHub", "Linear"].includes(connector)) {
        return json(400, { delivered: false, error: "Invalid confirmation payload" });
      }

      try {
        const threadId = await photonAdapter.openDM(phoneNumber);
        await photonAdapter.postMessage(
          threadId,
          `${connector} is connected. I can now use your authorized ${connector} account when you ask.`,
        );
        return json(200, { delivered: true });
      }
      catch (error) {
        logEvent("error", "photon.connection_confirmation.failed", {
          phoneRef: opaqueReference(phoneNumber),
          connector,
          errorKind: errorKind(error),
          errorCode: errorCode(error),
          errorMessage: safeErrorMessage(error, [
            phoneNumber,
            process.env.SPECTRUM_PROJECT_SECRET ?? "",
            process.env.IMESSAGE_PROJECT_SECRET ?? "",
          ]),
        });
        return json(502, { delivered: false, error: "Delivery failed" });
      }
    }),
    POST("/eve/v1/system/waitlist-invitation", async (request) => {
      const startedAt = Date.now();
      const requestId = createRequestId(request.headers.get("x-request-id"));
      const secret = process.env.INTERNAL_API_SECRET?.trim();
      if (!secret) return json(503, { accepted: false, error: "Internal delivery is not configured" });
      if (request.headers.get("authorization") !== `Bearer ${secret}`) {
        return json(401, { accepted: false, error: "Unauthorized" });
      }
      if (!isPhotonCloudConfigured()) {
        return json(503, { accepted: false, error: "Photon Cloud is not configured" });
      }

      let body: unknown;
      try {
        body = await request.json();
      }
      catch {
        return json(400, { accepted: false, error: "Invalid JSON" });
      }

      const phoneNumber = body && typeof body === "object" && "phoneNumber" in body
        ? String(body.phoneNumber).trim()
        : "";
      if (!/^\+[1-9]\d{7,14}$/u.test(phoneNumber)) {
        return json(400, { accepted: false, error: "Expected an E.164 phoneNumber" });
      }

      const fields = {
        requestId,
        phoneRef: opaqueReference(phoneNumber),
      };
      logEvent("info", "photon.invitation.started", fields);

      try {
        const threadId = await photonAdapter.openDM(phoneNumber);
        await photonAdapter.postMessage(
          threadId,
          [
            `You're in. This is ${agent.name}.`,
            "Reply START to verify this number and set up your personal agent here in Messages.",
          ].join("\n\n"),
        );
        logEvent("info", "photon.invitation.accepted", {
          ...fields,
          durationMs: Date.now() - startedAt,
        });
        return json(200, { accepted: true });
      }
      catch (error) {
        logEvent("error", "photon.invitation.failed", {
          ...fields,
          durationMs: Date.now() - startedAt,
          errorKind: errorKind(error),
          errorCode: errorCode(error),
          errorMessage: safeErrorMessage(error, [
            phoneNumber,
            process.env.SPECTRUM_PROJECT_SECRET ?? "",
            process.env.IMESSAGE_PROJECT_SECRET ?? "",
          ]),
        });
        return json(502, { accepted: false, error: "Invitation failed" });
      }
    }),
  ],
});
