import { describe, expect, it } from "vitest";
import {
  redactSandboxOutput,
  sandboxCwd,
  sandboxRepositoryInputSchema,
  truncateSandboxOutput,
} from "./sandbox.js";

describe("sandboxRepositoryInputSchema", () => {
  it("accepts bounded repository commands", () => {
    expect(sandboxRepositoryInputSchema.parse({
      repository: "Montekkundan/use-memory",
      reason: "Run the test suite",
      commands: [{ cmd: "pnpm", args: ["test"], cwd: "app" }],
    }).stopOnFailure).toBe(true);
  });

  it("rejects shell entrypoints and path traversal", () => {
    expect(() => sandboxRepositoryInputSchema.parse({
      repository: "Montekkundan/use-memory",
      reason: "Unsafe",
      commands: [{ cmd: "bash", args: ["-lc", "env"] }],
    })).toThrow();
    expect(() => sandboxRepositoryInputSchema.parse({
      repository: "Montekkundan/use-memory",
      reason: "Unsafe cwd",
      commands: [{ cmd: "pnpm", args: ["test"], cwd: "../other" }],
    })).toThrow();
  });
});

describe("sandbox output safety", () => {
  it("keeps relative work inside the checkout", () => {
    expect(sandboxCwd()).toBe("/vercel/sandbox");
    expect(sandboxCwd("packages/app")).toBe("/vercel/sandbox/packages/app");
  });

  it("redacts credentials and reports truncation", () => {
    expect(redactSandboxOutput(
      "https://x-access-token:secret@github.com/a/b ghp_1234567890abcdef",
      ["secret"],
    )).not.toContain("secret");
    expect(truncateSandboxOutput("abcdef", 3)).toEqual({
      text: "abc\n… output truncated …",
      truncated: true,
    });
  });
});
