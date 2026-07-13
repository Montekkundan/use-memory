import { z } from "zod";
import {
  createRequestId,
  errorKind,
  logEvent,
  opaqueReference,
} from "#shared/observability";
import { WAITLIST_PLATFORMS } from "#shared/types/waitlist";
import { joinWaitlist } from "~~/server/utils/waitlist";

const bodySchema = z.object({
  phoneNumber: z.string().trim().min(1),
  platform: z.enum(WAITLIST_PLATFORMS),
  email: z.string().trim().optional().nullable(),
});

export default defineEventHandler(async (event) => {
  const requestId = createRequestId(getHeader(event, "x-request-id") || getHeader(event, "x-vercel-id"));
  setHeader(event, "x-request-id", requestId);
  const input = await readValidatedBody(event, bodySchema.parse);

  try {
    const entry = await joinWaitlist(input);
    logEvent("info", "waitlist.entry.joined", {
      requestId,
      phoneRef: opaqueReference(entry.phoneNumber),
      platform: entry.platform,
      status: entry.status,
    });
    return {
      joined: true,
      requestId,
      platform: entry.platform,
      status: entry.status,
    };
  }
  catch (error) {
    logEvent("error", "waitlist.entry.failed", {
      requestId,
      platform: input.platform,
      errorKind: errorKind(error),
    });
    if (error instanceof RangeError) {
      throw createError({ statusCode: 400, statusMessage: error.message });
    }
    throw error;
  }
});
