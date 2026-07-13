import { z } from "zod";
import { Mem0ConfigurationError } from "~~/server/utils/mem0-client";
import { deleteAutomaticMemory } from "~~/server/utils/mem0";
import { requireSessionUserId } from "~~/server/utils/session";

const paramsSchema = z.object({
  id: z.string().trim().min(1).max(300),
});

export default defineEventHandler(async (event) => {
  const userId = await requireSessionUserId(event);
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse);

  try {
    const deleted = await deleteAutomaticMemory(userId, id);
    if (!deleted) {
      throw createError({ statusCode: 404, statusMessage: "Memory not found" });
    }
    return { deleted: true };
  }
  catch (error) {
    if (error instanceof Mem0ConfigurationError) {
      throw createError({ statusCode: 503, statusMessage: error.message });
    }
    throw error;
  }
});
