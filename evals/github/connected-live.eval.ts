import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";
import { requireAuthenticatedHeaders } from "../helpers.js";

interface ConnectorSummary {
  id: string;
  status: { state: string };
}

interface GitHubCommit {
  sha: string;
  commit: { message: string };
}

export default defineEval({
  description: "The connected user's GitHub tools return the real latest use-memory commit.",
  tags: ["github", "authenticated", "live"],
  timeoutMs: 120_000,
  async test(t) {
    const headers = requireAuthenticatedHeaders(t.skip);
    const connectorsResponse = await t.target.fetch("/api/connectors", { headers });
    if (!connectorsResponse.ok) {
      t.skip(`Authenticated connector check returned ${connectorsResponse.status}`);
    }

    const connectors = await connectorsResponse.json() as ConnectorSummary[];
    const github = connectors.find(connector => connector.id === "github");
    if (github?.status.state !== "connected") {
      t.skip("The eval user does not have a connected GitHub grant");
    }

    const truthResponse = await fetch(
      "https://api.github.com/repos/Montekkundan/use-memory/commits?per_page=1",
      { headers: { Accept: "application/vnd.github+json", "User-Agent": "use-memory-eval" } },
    );
    if (!truthResponse.ok) {
      t.skip(`GitHub truth check returned ${truthResponse.status}`);
    }
    const [latest] = await truthResponse.json() as GitHubCommit[];
    if (!latest) {
      t.skip("GitHub returned no commits for Montekkundan/use-memory");
    }

    await t.send({
      headers,
      message: "List the latest 3 commits on Montekkundan/use-memory main. Include each short SHA and commit message.",
    });

    t.succeeded();
    t.noFailedActions();
    t.calledTool("listCommits");
    t.check(t.reply, includes(latest.sha.slice(0, 7)));
    t.check(t.reply, includes(latest.commit.message.split("\n", 1)[0]!));
  },
});
