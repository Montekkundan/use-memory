import { describe, expect, it } from "vitest";
import {
  isIanaTimezone,
  resolveTimezoneInput,
} from "./onboarding-input";

describe("onboarding input", () => {
  it("validates IANA timezones", () => {
    expect(isIanaTimezone("America/Toronto")).toBe(true);
    expect(isIanaTimezone("Toronto-ish")).toBe(false);
  });

  it("canonicalizes only validated IANA timezones", () => {
    expect(resolveTimezoneInput("america/toronto")).toBe("America/Toronto");
    expect(resolveTimezoneInput("America/Toronto")).toBe("America/Toronto");
    expect(resolveTimezoneInput("Montreal, canada")).toBeNull();
    expect(resolveTimezoneInput("somewhere on Mars")).toBeNull();
  });
});
