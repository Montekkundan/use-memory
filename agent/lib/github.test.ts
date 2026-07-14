import { describe, expect, it } from "vitest";
import { buildBundledEveGithubToolMap } from "./github-eve-adapter.js";
import { githubApprovalForChannel } from "../tools/github.js";

describe("githubApprovalForChannel", () => {
  it.each(["chat-sdk", "photon"])(
    "allows only non-destructive PR publishing writes in %s",
    (channelKind) => {
      expect(githubApprovalForChannel(channelKind)).toEqual({
        createBranch: false,
        createOrUpdateFile: false,
        createPullRequest: false,
      });
    },
  );

  it.each([undefined, "http", "web"])(
    "keeps normal approvals outside iMessage (%s)",
    (channelKind) => {
      expect(githubApprovalForChannel(channelKind)).toBe(true);
    },
  );
});

describe("buildBundledEveGithubToolMap", () => {
  it("exposes connected GitHub read tools without approval", () => {
    const tools = buildBundledEveGithubToolMap({
      requireApproval: true,
      token: "test-token",
    });

    expect(tools.listCommits).toMatchObject({
      approval: undefined,
      description: expect.stringContaining("commits"),
      execute: expect.any(Function),
    });
  });

  it("preserves web approvals for GitHub writes", async () => {
    const tools = buildBundledEveGithubToolMap({
      requireApproval: true,
      token: "test-token",
    });

    expect(await tools.createBranch?.approval?.({} as never)).toBe("user-approval");
  });

  it("allows the iMessage publish sequence but protects other writes", async () => {
    const tools = buildBundledEveGithubToolMap({
      requireApproval: githubApprovalForChannel("photon"),
      token: "test-token",
    });

    expect(await tools.createBranch?.approval?.({} as never)).toBe("not-applicable");
    expect(await tools.createOrUpdateFile?.approval?.({} as never)).toBe("not-applicable");
    expect(await tools.createPullRequest?.approval?.({} as never)).toBe("not-applicable");
    expect(await tools.mergePullRequest?.approval?.({} as never)).toBe("user-approval");
  });
});
