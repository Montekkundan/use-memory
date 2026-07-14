import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

const marker = "USE_MEMORY_WEB_EVAL_OK";

export default defineEval({
  description: "The web/Eve transport accepts a normal turn and returns an assistant message.",
  tags: ["smoke", "web"],
  metadata: { surface: "web" },
  async test(t) {
    await t.send(`Reply with exactly ${marker} and nothing else.`);

    t.succeeded();
    t.noFailedActions();
    t.usedNoTools();
    t.check(t.reply, includes(marker));
  },
});
