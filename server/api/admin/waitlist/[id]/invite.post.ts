import { z } from "zod";
import {
  createRequestId,
  errorKind,
  logEvent,
  opaqueReference,
} from "#shared/observability";
import { sendWaitlistInvitation } from "~~/server/utils/auth-delivery";
import {
  getWaitlistEntry,
  grantWaitlistAccess,
  recordWaitlistInvitationResult,
} from "~~/server/utils/waitlist";
import { requireWaitlistAdmin } from "~~/server/utils/waitlist-admin";

const paramsSchema = z.object({ id: z.string().uuid() });

export default defineEventHandler(async (event) => {
  const startedAt = Date.now();
  const requestId = createRequestId(getHeader(event, "x-request-id") || getHeader(event, "x-vercel-id"));
  setHeader(event, "x-request-id", requestId);
  const adminUserId = await requireWaitlistAdmin(event);
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse);
  const existing = await getWaitlistEntry(id);
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "Waitlist entry not found" });
  }
  if (existing.platform !== "iphone") {
    throw createError({
      statusCode: 409,
      statusMessage: "Android invitations need a configured Android messaging channel",
    });
  }

  const entry = await grantWaitlistAccess(id);
  if (!entry) {
    throw createError({ statusCode: 404, statusMessage: "Waitlist entry not found" });
  }

  const fields = {
    requestId,
    waitlistEntryId: id,
    adminRef: opaqueReference(adminUserId),
    phoneRef: opaqueReference(entry.phoneNumber),
  };
  logEvent("info", "waitlist.invitation.started", fields);

  try {
    await sendWaitlistInvitation(entry.phoneNumber, requestId);
    await recordWaitlistInvitationResult(id, { accepted: true });
    logEvent("info", "waitlist.invitation.accepted", {
      ...fields,
      durationMs: Date.now() - startedAt,
    });
    return {
      accessGranted: true,
      acceptedByPhoton: true,
      invitationAcceptedByPhoton: true,
      requestId,
      entry: await getWaitlistEntry(id),
    };
  }
  catch (error) {
    const message = error instanceof Error ? error.message : "Photon invitation failed";
    await recordWaitlistInvitationResult(id, { accepted: false, error: message });
    logEvent("error", "waitlist.invitation.failed", {
      ...fields,
      durationMs: Date.now() - startedAt,
      errorKind: errorKind(error),
    });
    return {
      accessGranted: true,
      acceptedByPhoton: false,
      invitationAcceptedByPhoton: false,
      requestId,
      entry: await getWaitlistEntry(id),
    };
  }
});
