import { Mem0ConfigurationError } from "~~/server/utils/mem0-client";
import { forgetAllAutomaticMemories } from "~~/server/utils/mem0";
import { requireSessionUserId } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireSessionUserId(event);

  try {
    await forgetAllAutomaticMemories(userId);
    return { deleted: true };
  }
  catch (error) {
    if (error instanceof Mem0ConfigurationError) {
      throw createError({ statusCode: 503, statusMessage: error.message });
    }
    throw error;
  }
});
