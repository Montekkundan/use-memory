import { describe, expect, it } from "vitest";
import { normalizeE164 } from "./phone";

describe("normalizeE164", () => {
  it.each([
    ["+14165551234", "+14165551234"],
    ["1 (416) 555-1234", "+14165551234"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeE164(input)).toBe(expected);
  });

  it.each(["", "123", "+0123456789", "+".padEnd(18, "1")])("rejects %s", (input) => {
    expect(() => normalizeE164(input)).toThrow(RangeError);
  });
});
