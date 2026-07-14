import { defineTool } from "eve/tools";
import { z } from "zod";
import { MEMORY_CATEGORIES } from "../lib/memory-categories.js";
import { saveMemoryRemote } from "../lib/memory-internal.js";
import { sessionUserId } from "../lib/session-user.js";

const updateSchema = z.object({
  category: z.enum(MEMORY_CATEGORIES).describe("Memory category to update"),
  content: z.string().min(1).describe("Full replacement prose for this category (not a partial delta)"),
});

export default defineTool({
  description:
    "Save an explicitly requested update to curated, pinned profile memory. It executes immediately without a second confirmation. Ordinary conversation facts are handled by automatic Mem0 memory instead. When several categories change, include every update in a single call.",
  inputSchema: z.object({
    reason: z.string().min(1).describe("Brief explanation of why these updates are worth remembering"),
    updates: z.array(updateSchema).min(1).max(5).describe("Category updates to save together"),
  }),
  async execute({ updates }, ctx) {
    const userId = sessionUserId(ctx.session.auth.current);
    if (!userId) {
      throw new Error("Cannot save memory without an authenticated user");
    }

    const results = [];
    for (const update of updates) {
      const result = await saveMemoryRemote({
        userId,
        category: update.category,
        content: update.content,
      });
      results.push({
        category: update.category,
        saved: result.saved,
      });
    }

    return {
      message: "Got it — I’ll remember that.",
      results,
    };
  },
});
