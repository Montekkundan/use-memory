import { describe, expect, it } from "vitest";
import {
  applyPersonalityPatch,
  DEFAULT_ACTION_PREFERENCES,
  personalityMarkdownFromPreferences,
  personalityPreferencesFromMarkdown,
  personalityPatchSchema,
} from "./personality-schema";

describe("personality schema", () => {
  it("builds a stable per-user personality.md without duplicate notes", () => {
    const markdown = personalityMarkdownFromPreferences([
      "Keep replies concise.",
      "Use examples when explaining code.",
      "keep replies concise.",
    ]);

    expect(markdown).toBe([
      "## Preferences",
      "",
      "- keep replies concise.",
      "- Use examples when explaining code.",
    ].join("\n"));
    expect(personalityPreferencesFromMarkdown(markdown)).toEqual([
      "keep replies concise.",
      "Use examples when explaining code.",
    ]);
  });

  it("updates explicit working defaults separately from prose preferences", () => {
    const result = applyPersonalityPatch({
      markdown: "## Preferences\n\n- Ask one question at a time.\n- Keep replies concise.",
      actions: DEFAULT_ACTION_PREFERENCES,
    }, {
      remember: ["Use TypeScript examples by default."],
      forget: ["Keep replies concise."],
      actions: { commit: "always", push: "always" },
    });

    expect(result.markdown).toContain("Ask one question at a time.");
    expect(result.markdown).toContain("Use TypeScript examples by default.");
    expect(result.markdown).not.toContain("Keep replies concise.");
    expect(result.actions).toEqual({
      commit: "always",
      push: "always",
      openPullRequest: "ask",
    });
  });

  it("rejects an empty update so defaults cannot change by inference", () => {
    expect(() => personalityPatchSchema.parse({})).toThrow();
  });
});
