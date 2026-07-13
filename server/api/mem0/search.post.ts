import { z } from "zod";
import { Mem0ConfigurationError } from "~~/server/utils/mem0-client";
import { searchAutomaticMemories } from "~~/server/utils/mem0";
import { requireSessionUserId } from "~~/server/utils/session";

const searchBodySchema = z.object({
  query: z.string().trim().min(1).max(500),
  limit: z.number().int().min(1).max(8).default(8),
});

export default defineEventHandler(async (event) => {
  const userId = await requireSessionUserId(event);
  const body = await readValidatedBody(event, searchBodySchema.parse);

  try {
    const memories = await searchAutomaticMemories(userId, body.query, body.limit);
    return { memories };
  }
  catch (error) {
    if (error instanceof Mem0ConfigurationError) {
      throw createError({ statusCode: 503, statusMessage: error.message });
    }
    throw error;
  }
});
