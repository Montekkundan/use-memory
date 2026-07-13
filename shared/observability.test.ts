import { describe, expect, it } from "vitest";
import { errorCode, safeErrorMessage } from "./observability";

describe("safe error diagnostics", () => {
  it("keeps transport diagnostics while redacting phone numbers and codes", () => {
    const error = Object.assign(new Error("unused"), {
      code: 16,
      details: "UNAUTHENTICATED for +14165551234 with code 123456",
    });

    expect(errorCode(error)).toBe("16");
    expect(safeErrorMessage(error)).toBe(
      "UNAUTHENTICATED for [redacted-phone] with code [redacted-code]",
    );
  });

  it("redacts explicit secrets and URL credentials", () => {
    const error = new Error("https://user:password@example.com secret-value");

    expect(safeErrorMessage(error, ["secret-value"])).toBe(
      "https://[redacted]@example.com [redacted]",
    );
  });
});
