import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildBundledEveGithubToolMap: vi.fn(),
  fetchUserContext: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock("@vercel/connect", () => ({
  getToken: mocks.getToken,
  NoValidTokenError: class NoValidTokenError extends Error {},
  UserAuthorizationRequiredError: class UserAuthorizationRequiredError extends Error {},
}));

vi.mock("./github-eve-adapter.js", () => ({
  buildBundledEveGithubToolMap: mocks.buildBundledEveGithubToolMap,
}));

vi.mock("./memory-internal.js", () => ({
  fetchUserContext: mocks.fetchUserContext,
}));

import githubDynamic from "../tools/github";
import { UserAuthorizationRequiredError } from "@vercel/connect";

function context(channelKind: string) {
  return {
    channel: { kind: channelKind },
    session: {
      auth: {
        current: {
          authenticator: "app",
          issuer: "app",
          principalId: "user-123",
          principalType: "user",
        },
      },
    },
  } as never;
}

describe("dynamic GitHub tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchUserContext.mockResolvedValue(null);
    mocks.getToken.mockResolvedValue("github-token");
    mocks.buildBundledEveGithubToolMap.mockReturnValue({
      searchRepositories: { execute: vi.fn() },
    });
  });

  it("re-resolves GitHub access on every turn so an existing iMessage session sees a new grant", async () => {
    const events = githubDynamic.events as Record<string, (event: never, ctx: never) => Promise<unknown>>;

    expect(events["turn.started"]).toBeTypeOf("function");
    await events["turn.started"]!({} as never, context("photon"));
    await events["turn.started"]!({} as never, context("photon"));

    expect(mocks.getToken).toHaveBeenCalledTimes(2);
    expect(mocks.buildBundledEveGithubToolMap).toHaveBeenCalledTimes(2);
  });

  it("uses the same Better Auth user subject for web and iMessage", async () => {
    const events = githubDynamic.events as Record<string, (event: never, ctx: never) => Promise<unknown>>;

    await events["turn.started"]!({} as never, context("web"));
    await events["turn.started"]!({} as never, context("photon"));

    expect(mocks.getToken).toHaveBeenNthCalledWith(1, "github/use-memory", expect.objectContaining({
      subject: { type: "user", id: "user-123", issuer: "app" },
    }), expect.anything());
    expect(mocks.getToken).toHaveBeenNthCalledWith(2, "github/use-memory", expect.objectContaining({
      subject: { type: "user", id: "user-123", issuer: "app" },
    }), expect.anything());
  });

  it("falls back to the issuer-less subject used by older grants", async () => {
    mocks.getToken
      .mockRejectedValueOnce(new UserAuthorizationRequiredError("missing app-issued grant"))
      .mockResolvedValueOnce("legacy-grant-token");
    const events = githubDynamic.events as Record<string, (event: never, ctx: never) => Promise<unknown>>;

    await events["turn.started"]!({} as never, context("photon"));

    expect(mocks.getToken).toHaveBeenNthCalledWith(1, "github/use-memory", expect.objectContaining({
      subject: { type: "user", id: "user-123", issuer: "app" },
    }), expect.anything());
    expect(mocks.getToken).toHaveBeenNthCalledWith(2, "github/use-memory", expect.objectContaining({
      subject: { type: "user", id: "user-123" },
    }), expect.anything());
    expect(mocks.buildBundledEveGithubToolMap).toHaveBeenCalledWith(expect.objectContaining({
      token: "legacy-grant-token",
    }));
  });

  it("keeps the chat turn available when Vercel Connect is temporarily unavailable", async () => {
    mocks.getToken.mockRejectedValue(new Error("connect unavailable"));
    const events = githubDynamic.events as Record<string, (event: never, ctx: never) => Promise<unknown>>;

    await expect(events["turn.started"]!({} as never, context("photon")))
      .resolves.toEqual({});
    expect(mocks.buildBundledEveGithubToolMap).not.toHaveBeenCalled();
  });
});
