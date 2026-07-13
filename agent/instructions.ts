import { defineDynamic, defineInstructions } from "eve/instructions";
import type { DynamicResolveContext } from "eve/instructions";
import { BASE_INSTRUCTIONS } from "./lib/base-instructions.js";
import { buildUserContextPrompt, fetchUserContext } from "./lib/memory-internal.js";
import {
  buildAutomaticRecallPrompt,
  fetchAutomaticRecall,
  recallQueryFromMessages,
} from "./lib/mem0-internal.js";

const IMESSAGE_INSTRUCTIONS = `

# iMessage (Photon Cloud)

- This conversation is over iMessage. There is no browser UI for tool approvals in this thread.
- Answer the user's question directly. Use GitHub, coding sandbox, weather, and other tools when relevant.
- Do **not** call \`save_memory\` in iMessage because this channel has no browser approval UI. When automatic memory is enabled, explicit facts in this conversation are staged for Mem0 after the turn; curated memory remains manageable in Settings.
- Use \`update_profile\` when the user explicitly asks to change their safe profile fields; this works directly in iMessage.
- When automatic memory is enabled, explicit facts shared in this conversation are eligible for Mem0 after the turn. Never store credentials, verification codes, or secrets.`;

function instructionsForChannel(kind: string | undefined, base: string) {
  if (kind === "chat-sdk" || kind === "photon") {
    return `${base}${IMESSAGE_INSTRUCTIONS}`;
  }
  return base;
}

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx: DynamicResolveContext) => {
      const userId = ctx.session.auth.current?.principalId;
      if (!userId || userId.startsWith("eve:")) {
        return defineInstructions({
          markdown: instructionsForChannel(ctx.channel.kind, BASE_INSTRUCTIONS),
        });
      }

      const context = await fetchUserContext(userId);
      if (!context) {
        return defineInstructions({
          markdown: instructionsForChannel(ctx.channel.kind, BASE_INSTRUCTIONS),
        });
      }

      const userBlock = buildUserContextPrompt(context);
      return defineInstructions({
        markdown: instructionsForChannel(
          ctx.channel.kind,
          `${BASE_INSTRUCTIONS}\n\n---\n\n${userBlock}`,
        ),
      });
    },
    "turn.started": async (_event, ctx: DynamicResolveContext) => {
      const userId = ctx.session.auth.current?.principalId;
      if (!userId || userId.startsWith("eve:")) {
        return null;
      }

      const memories = await fetchAutomaticRecall({
        userId,
        query: recallQueryFromMessages(ctx.messages),
        limit: 8,
      });
      const markdown = buildAutomaticRecallPrompt(memories);
      return markdown ? defineInstructions({ markdown }) : null;
    },
  },
});
