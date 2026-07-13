import { describe, expect, it } from "vitest";
import { containsSensitiveMemoryContent, safeMemoryText } from "./mem0-safety";

describe("automatic memory safety", () => {
  it.each([
    "My API key is sk-abcdefghijklmnopqrstuvwxyz",
    "Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
    "Use verification code 482913",
    "https://example.com/callback?code=secret-code-value",
    "github_pat_abcdefghijklmnopqrstuvwxyz123456",
  ])("rejects credential-like content", (content) => {
    expect(containsSensitiveMemoryContent(content)).toBe(true);
  });

  it("allows ordinary preferences and dates", () => {
    expect(containsSensitiveMemoryContent("I prefer morning meetings after 2026-07-13.")).toBe(false);
  });

  it("trims and bounds staged content", () => {
    expect(safeMemoryText("  hello  ", 4)).toBe("hell");
    expect(safeMemoryText("   ")).toBeUndefined();
  });
});
