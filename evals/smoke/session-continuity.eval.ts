import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

const marker = "marigold-7319";

export default defineEval({
  description: "A web conversation keeps short-term context across consecutive turns.",
  tags: ["smoke", "web", "session"],
  metadata: { surface: "web" },
  async test(t) {
    await t.send(`For this conversation only, remember the marker ${marker}. Acknowledge briefly.`);
    const recall = await t.send("What marker did I just give you? Reply with only the marker.");

    t.succeeded();
    t.noFailedActions();
    recall.messageIncludes(marker);
    t.check(t.reply, includes(marker));
  },
});
