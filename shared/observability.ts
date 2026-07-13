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

export function logEvent(level: LogLevel, event: string, fields: LogFields = {}) {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...fields,
  });
  console[level](record);
}
