import { defineTool } from "eve/tools";
import {
  toolChangesToProfilePatch,
  updateProfileToolInputSchema,
  updateProfileToolResultSchema,
} from "../../shared/profile-schema.js";
import { updateProfileRemote } from "../lib/profile-internal.js";
import { sessionUserId } from "../lib/session-user.js";

export default defineTool({
  description:
    "Update the authenticated user's safe profile fields only after they explicitly request a change to their name, bio, timezone, or preferred language. Never use this tool for email, phone, account identity, authentication, or another user.",
  inputSchema: updateProfileToolInputSchema,
  outputSchema: updateProfileToolResultSchema,
  async execute({ changes }, ctx) {
    const userId = sessionUserId(ctx.session.auth.current);
    if (!userId) {
      throw new Error("Cannot update a profile without an authenticated user");
    }

    const { profile } = await updateProfileRemote({
      userId,
      patch: toolChangesToProfilePatch(changes),
    });

    return {
      updated: Object.keys(changes) as Array<keyof typeof changes>,
      profile,
    };
  },
});
