import { internalProfileUpdateResponseSchema } from "#shared/profile-schema";
import { internalProfileUpdateBodySchema } from "~~/server/schemas/profile";
import { requireInternalRequest } from "~~/server/utils/internal-api";
import { updateProfileForUser } from "~~/server/utils/profile";

export default defineEventHandler(async (event) => {
  requireInternalRequest(event);

  const { userId, patch } = await readValidatedBody(
    event,
    internalProfileUpdateBodySchema.parse,
  );
  const profile = await updateProfileForUser(userId, patch);

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found",
    });
  }

  return internalProfileUpdateResponseSchema.parse({
    profile: {
      name: profile.name,
      bio: profile.bio,
      timezone: profile.timezone,
      language: profile.locale,
    },
  });
});
