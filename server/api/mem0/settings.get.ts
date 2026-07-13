import { getAutomaticMemorySettings } from "~~/server/utils/mem0";
import { requireSessionUserId } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireSessionUserId(event);
  const settings = await getAutomaticMemorySettings(userId);
  return { settings };
});
