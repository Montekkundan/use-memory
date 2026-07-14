import { defineEval } from "eve/evals";
import { equals, includes } from "eve/evals/expect";
import { requireAuthenticatedHeaders } from "../helpers.js";

interface ProfileResponse {
  profile: {
    timezone: string;
  };
}

export default defineEval({
  description: "The agent resolves a natural location to an IANA timezone and updates the profile.",
  tags: ["profile", "reasoning", "authenticated", "live"],
  timeoutMs: 120_000,
  async test(t) {
    const headers = requireAuthenticatedHeaders(t.skip);
    const originalResponse = await t.target.fetch("/api/profile", { headers });
    if (!originalResponse.ok) {
      t.skip(`Authenticated profile check returned ${originalResponse.status}`);
    }
    const original = await originalResponse.json() as ProfileResponse;

    try {
      await t.send({
        headers,
        message: "I moved to Montreal, Canada. Update my profile timezone based on that location now.",
      });

      t.succeeded();
      t.noFailedActions();
      t.calledTool("update_profile", {
        input: { changes: { timezone: "America/Toronto" } },
        count: 1,
      });
      t.check(t.reply, includes("America/Toronto"));

      const updatedResponse = await t.target.fetch("/api/profile", { headers });
      const updated = await updatedResponse.json() as ProfileResponse;
      t.check(updated.profile.timezone, equals("America/Toronto"));
    }
    finally {
      await t.target.fetch("/api/profile", {
        method: "PATCH",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ timezone: original.profile.timezone }),
      });
    }
  },
});
