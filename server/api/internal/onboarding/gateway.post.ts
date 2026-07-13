import { z } from "zod";
import { handleOnboardingGateway } from "~~/server/utils/onboarding";
import { requireInternalRequest } from "~~/server/utils/internal-api";

const bodySchema = z.object({
  attachments: z.array(z.object({
    mimeType: z.string().optional(),
    name: z.string().optional(),
    type: z.enum(["audio", "file", "image", "video"]),
  })).optional(),
  messageId: z.string().trim().min(1).optional(),
  phoneNumber: z.string().trim().min(1),
  text: z.string(),
  threadId: z.string().trim().min(1),
});

export default defineEventHandler(async (event) => {
  requireInternalRequest(event);
  const body = await readValidatedBody(event, bodySchema.parse);
  return handleOnboardingGateway(body);
});
