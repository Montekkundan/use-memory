import { createHash, randomUUID } from "node:crypto";

type LogLevel = "info" | "warn" | "error";
type LogFields = Record<string, boolean | number | string | null | undefined>;

export function createRequestId(candidate?: string | null) {
  const value = candidate?.trim();
  return value && /^[\w./:-]{1,128}$/u.test(value) ? value : randomUUID();
}

export function opaqueReference(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function errorKind(error: unknown) {
  return error instanceof Error ? error.name : "UnknownError";
}

export function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const value = error.code;
  return typeof value === "number" || typeof value === "string"
    ? String(value).slice(0, 64)
    : undefined;
}

export function safeErrorMessage(error: unknown, sensitiveValues: string[] = []) {
  const value = error && typeof error === "object" && "details" in error
    && typeof error.details === "string"
    ? error.details
    : error instanceof Error
      ? error.message
      : "";

  let redacted = value
    .replace(/\+[1-9]\d{7,14}/gu, "[redacted-phone]")
    .replace(/\b\d{6}\b/gu, "[redacted-code]")
    .replace(/:\/\/[^\s/@:]+:[^\s/@]+@/gu, "://[redacted]@");

  for (const sensitiveValue of sensitiveValues) {
    if (sensitiveValue) redacted = redacted.replaceAll(sensitiveValue, "[redacted]");
  }

  return redacted.replace(/\s+/gu, " ").trim().slice(0, 240) || undefined;
}

export function logEvent(level: LogLevel, event: string, fields: LogFields = {}) {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...fields,
  });
  console[level](record);
}
