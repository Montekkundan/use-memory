import {
  internalPersonalityUpdateBodySchema,
  internalPersonalityUpdateResponseSchema,
} from "#shared/personality-schema";
import { requireInternalRequest } from "~~/server/utils/internal-api";
import { updatePersonalityForUser } from "~~/server/utils/personality";

export default defineEventHandler(async (event) => {
  requireInternalRequest(event);
  const { userId, patch } = await readValidatedBody(
    event,
    internalPersonalityUpdateBodySchema.parse,
  );
  const personality = await updatePersonalityForUser(userId, patch);
  return internalPersonalityUpdateResponseSchema.parse({ personality });
});
