import { describe, expect, it } from "vitest";
import { buildBundledEveGithubToolMap } from "./github-eve-adapter.js";
import { githubApprovalForChannel } from "../tools/github.js";

describe("githubApprovalForChannel", () => {
  it.each(["chat-sdk", "photon"])(
    "requires approval for every write by default in %s",
    (channelKind) => {
      expect(githubApprovalForChannel(channelKind)).toEqual({
        createBranch: true,
        createOrUpdateFile: true,
        createPullRequest: true,
      });
    },
  );

  it("relaxes only the explicitly saved iMessage working defaults", () => {
    expect(githubApprovalForChannel("photon", {
      commit: "always",
      push: "always",
      openPullRequest: "ask",
    })).toEqual({
      createBranch: false,
      createOrUpdateFile: false,
      createPullRequest: true,
    });
  });

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
      requireApproval: githubApprovalForChannel("photon", {
        commit: "always",
        push: "always",
        openPullRequest: "always",
      }),
      token: "test-token",
    });

    expect(await tools.createBranch?.approval?.({} as never)).toBe("not-applicable");
    expect(await tools.createOrUpdateFile?.approval?.({} as never)).toBe("not-applicable");
    expect(await tools.createPullRequest?.approval?.({} as never)).toBe("not-applicable");
    expect(await tools.mergePullRequest?.approval?.({} as never)).toBe("user-approval");
  });

  it("rejects a file write that omits its branch", async () => {
    const tools = buildBundledEveGithubToolMap({
      requireApproval: false,
      token: "test-token",
    });

    await expect(tools.createOrUpdateFile?.execute?.({
      owner: "Montekkundan",
      repo: "use-memory",
      path: "README.md",
      content: "unsafe",
      message: "test",
    }, {} as never)).rejects.toThrow("requires a repository and explicit non-default branch");
  });

  it("rejects a direct write to the repository default branch", async () => {
    const tools = buildBundledEveGithubToolMap({
      requireApproval: false,
      resolveDefaultBranch: async () => "main",
      token: "test-token",
    });

    await expect(tools.createOrUpdateFile?.execute?.({
      owner: "Montekkundan",
      repo: "use-memory",
      branch: "main",
      path: "README.md",
      content: "unsafe",
      message: "test",
    }, {} as never)).rejects.toThrow("Direct writes to the default branch (main) are not allowed");
  });
});
