import { defineDynamic, defineInstructions } from "eve/instructions";
import type { DynamicResolveContext } from "eve/instructions";
import { BASE_INSTRUCTIONS } from "./lib/base-instructions.js";
import { isIMessageChannelKind } from "./lib/channel-kind.js";
import { buildUserContextPrompt, fetchUserContext } from "./lib/memory-internal.js";
import {
  buildAutomaticRecallPrompt,
  fetchAutomaticRecall,
  recallQueryFromMessages,
} from "./lib/mem0-internal.js";
import { sessionUserId } from "./lib/session-user.js";

const IMESSAGE_INSTRUCTIONS = `

# iMessage (Photon Cloud)

- This conversation is over iMessage.
- Answer the user's question directly. Use GitHub, coding sandbox, weather, and other tools when relevant.
- Ordinary facts the user asks you to remember are saved by automatic memory when consent is enabled. Acknowledge them naturally without mentioning internal tools or asking for a second confirmation.
- Use \`save_memory\` only when the user explicitly asks to pin or edit curated profile memory. It executes directly in this channel.
- Use \`update_profile\` when the user explicitly asks to change their safe profile fields; this works directly in iMessage.
- Use \`update_personality\` when the user explicitly asks you to remember, forget, or change a lasting collaboration preference; this also works directly in iMessage.
- When automatic memory is enabled, explicit facts shared in this conversation are eligible for Mem0 after the turn. Never store credentials, verification codes, or secrets.`;

function instructionsForChannel(kind: string | undefined, base: string) {
  if (isIMessageChannelKind(kind)) {
    return `${base}${IMESSAGE_INSTRUCTIONS}`;
  }
  return base;
}

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx: DynamicResolveContext) => {
      const userId = sessionUserId(ctx.session.auth.current);
      if (!userId) {
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
      const userId = sessionUserId(ctx.session.auth.current);
      if (!userId) {
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
