import { describe, expect, it } from "vitest";
import {
  isIanaTimezone,
  parseNumberedChoices,
  parseOnboardingConsent,
} from "./onboarding-input";

describe("onboarding input", () => {
  it("parses consent choices", () => {
    expect(parseOnboardingConsent("YES")).toBe(true);
    expect(parseOnboardingConsent("2")).toBe(false);
    expect(parseOnboardingConsent("maybe")).toBeNull();
  });

  it("validates IANA timezones", () => {
    expect(isIanaTimezone("America/Toronto")).toBe(true);
    expect(isIanaTimezone("Toronto-ish")).toBe(false);
  });

  it("parses, deduplicates, and validates numbered multiselect", () => {
    const options = ["github", "linear", "slack"];
    expect(parseNumberedChoices("1, 3, 1", options, false)).toEqual(["github", "slack"]);
    expect(parseNumberedChoices("4", options, false)).toBeNull();
    expect(parseNumberedChoices("research, music", options, true)).toEqual(["research", "music"]);
  });
});
