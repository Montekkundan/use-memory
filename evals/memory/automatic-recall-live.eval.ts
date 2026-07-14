import { randomUUID } from "node:crypto";
import { defineEval } from "eve/evals";
import { includes, satisfies } from "eve/evals/expect";

interface ProfileResponse {
  profile: {
    userId: string;
  };
}

interface MemorySettingsResponse {
  settings: {
    enabled: boolean;
  };
}

interface MemorySearchResponse {
  memories: Array<{
    memory: string;
  }>;
}

function dedicatedMemoryEvalConfig(skip: (reason: string) => never) {
  const cookie = process.env.EVAL_MEMORY_BETTER_AUTH_COOKIE?.trim();
  const expectedUserId = process.env.EVAL_MEMORY_EXPECTED_USER_ID?.trim();
  const allowForgetAll = process.env.EVAL_MEMORY_ALLOW_FORGET_ALL === "true";

  if (!cookie || !expectedUserId || !allowForgetAll) {
    skip(
      "A dedicated eval account requires EVAL_MEMORY_BETTER_AUTH_COOKIE, "
      + "EVAL_MEMORY_EXPECTED_USER_ID, and EVAL_MEMORY_ALLOW_FORGET_ALL=true",
    );
  }

  return { expectedUserId, headers: { cookie } };
}

async function requireOk(response: Response, operation: string) {
  if (!response.ok) {
    throw new Error(`${operation} failed (${response.status})`);
  }
  return response;
}

export default defineEval({
  description: "Mem0 recalls a learned preference in a separate authenticated session.",
  tags: ["memory", "authenticated", "live", "destructive-eval-account-only"],
  timeoutMs: 180_000,
  async test(t) {
    const { expectedUserId, headers } = dedicatedMemoryEvalConfig(t.skip);
    const profileResponse = await requireOk(
      await t.target.fetch("/api/profile", { headers }),
      "Eval account verification",
    );
    const profile = await profileResponse.json() as ProfileResponse;
    if (profile.profile.userId !== expectedUserId) {
      t.skip("The memory eval cookie does not belong to EVAL_MEMORY_EXPECTED_USER_ID");
    }

    const settingsResponse = await requireOk(
      await t.target.fetch("/api/mem0/settings", { headers }),
      "Read memory settings",
    );
    const originalSettings = await settingsResponse.json() as MemorySettingsResponse;
    const marker = `cobalt-orchid-${randomUUID().slice(0, 8)}`;

    try {
      await requireOk(
        await t.target.fetch("/api/mem0/forget-all", { method: "DELETE", headers }),
        "Reset eval memory namespace",
      );
      await requireOk(
        await t.target.fetch("/api/mem0/settings", {
          method: "PATCH",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ enabled: true }),
        }),
        "Enable automatic memory",
      );

      const teach = t.newSession();
      const taught = await teach.send({
        headers,
        message: `Please remember that my preferred imaginary flower for future examples is ${marker}.`,
      });
      taught.expectOk();
      teach.succeeded();
      teach.noFailedActions();
      teach.notCalledTool("save_memory");
      t.check(
        taught.message,
        satisfies(
          message => typeof message === "string"
            && !/approve tool call|save_memory/i.test(message),
          "Memory acknowledgement uses natural language without exposing implementation details",
        ),
      );

      let indexed = false;
      for (let attempt = 1; attempt <= 24; attempt += 1) {
        const searchResponse = await requireOk(
          await t.target.fetch("/api/mem0/search", {
            method: "POST",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify({
              query: `${marker} indexing probe ${attempt}`,
              limit: 8,
            }),
          }),
          "Search automatic memory",
        );
        const search = await searchResponse.json() as MemorySearchResponse;
        indexed = search.memories.some(memory => memory.memory.includes(marker));
        if (indexed) break;
        await t.sleep(2_500);
      }
      await t.require(indexed, satisfies(value => value === true, "Mem0 indexed the learned preference"));

      const recall = t.newSession();
      const recalled = await recall.send({
        headers,
        message: "In an earlier conversation, what did I say my favorite imaginary flower is? Reply with its exact name.",
      });
      recalled.expectOk();
      recall.succeeded();
      recall.noFailedActions();

      t.check(
        [teach.sessionId, recall.sessionId],
        satisfies(
          value => Array.isArray(value) && Boolean(value[0]) && Boolean(value[1]) && value[0] !== value[1],
          "Teaching and recall use different Eve sessions",
        ),
      );
      t.check(recalled.message, includes(marker));
      t.succeeded();
    }
    finally {
      await requireOk(
        await t.target.fetch("/api/mem0/forget-all", { method: "DELETE", headers }),
        "Clean eval memory namespace",
      );
      await requireOk(
        await t.target.fetch("/api/mem0/settings", {
          method: "PATCH",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ enabled: originalSettings.settings.enabled }),
        }),
        "Restore memory settings",
      );
    }
  },
});
