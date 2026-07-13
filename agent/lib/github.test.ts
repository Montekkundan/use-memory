import { describe, expect, it } from "vitest";
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
