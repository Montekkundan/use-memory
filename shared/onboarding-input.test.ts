import { describe, expect, it } from "vitest";
import {
  isIanaTimezone,
  parseNumberedChoices,
  parseOnboardingConsent,
  resolveTimezoneInput,
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

  it("resolves natural location answers to canonical timezones", () => {
    expect(resolveTimezoneInput("Montreal, canada")).toBe("America/Toronto");
    expect(resolveTimezoneInput("Montréal")).toBe("America/Toronto");
    expect(resolveTimezoneInput("I live in Vancouver, Canada")).toBe("America/Vancouver");
    expect(resolveTimezoneInput("america/toronto")).toBe("America/Toronto");
    expect(resolveTimezoneInput("America/Toronto")).toBe("America/Toronto");
    expect(resolveTimezoneInput("somewhere on Mars")).toBeNull();
  });

  it("parses, deduplicates, and validates numbered multiselect", () => {
    const options = ["github", "calendar", "notes"];
    expect(parseNumberedChoices("1, 3, 1", options, false)).toEqual(["github", "notes"]);
    expect(parseNumberedChoices("4", options, false)).toBeNull();
    expect(parseNumberedChoices("research, music", options, true)).toEqual(["research", "music"]);
  });
});
