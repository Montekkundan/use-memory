import { defineEval } from "eve/evals";
import { equals, includes } from "eve/evals/expect";
import { requireAuthenticatedHeaders } from "../helpers.js";

interface ProfileResponse {
  profile: {
    name: string;
  };
}

export default defineEval({
  description: "An authenticated chat can update a safe profile name and the eval restores it.",
  tags: ["profile", "authenticated", "live"],
  timeoutMs: 120_000,
  async test(t) {
    const headers = requireAuthenticatedHeaders(t.skip);
    const originalResponse = await t.target.fetch("/api/profile", { headers });
    if (!originalResponse.ok) {
      t.skip(`Authenticated profile check returned ${originalResponse.status}`);
    }
    const original = await originalResponse.json() as ProfileResponse;
    const temporaryName = `Use Memory Eval ${Date.now().toString(36)}`;

    try {
      await t.send({
        headers,
        message: `Call me ${temporaryName}. Update my profile name now.`,
      });

      t.succeeded();
      t.noFailedActions();
      t.calledTool("update_profile", {
        input: { changes: { name: temporaryName } },
        count: 1,
      });
      t.check(t.reply, includes(temporaryName));

      const updatedResponse = await t.target.fetch("/api/profile", { headers });
      const updated = await updatedResponse.json() as ProfileResponse;
      t.check(updated.profile.name, equals(temporaryName));
    }
    finally {
      await t.target.fetch("/api/profile", {
        method: "PATCH",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ name: original.profile.name }),
      });
    }
  },
});
