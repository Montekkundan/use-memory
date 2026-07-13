import { z } from "zod";
import { requireInternalRequest } from "~~/server/utils/internal-api";
import { Mem0ConfigurationError } from "~~/server/utils/mem0-client";
import { recallAutomaticMemories } from "~~/server/utils/mem0";

const recallBodySchema = z.object({
  userId: z.string().trim().min(1).max(300),
  query: z.string().trim().min(1).max(2_000),
  limit: z.number().int().min(1).max(8).default(8),
});

export default defineEventHandler(async (event) => {
  requireInternalRequest(event);
  const body = await readValidatedBody(event, recallBodySchema.parse);

  try {
    const memories = await recallAutomaticMemories(body.userId, body.query, body.limit);
    return { memories };
  }
  catch (error) {
    if (error instanceof Mem0ConfigurationError) {
      throw createError({ statusCode: 503, statusMessage: error.message });
    }
    throw error;
  }
});
