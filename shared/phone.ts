export const E164_PATTERN = /^\+[1-9]\d{7,14}$/u;

export function normalizeE164(value: string) {
  const digits = value.trim().replace(/\D/gu, "");
  const normalized = digits ? `+${digits}` : "";
  if (!E164_PATTERN.test(normalized)) {
    throw new RangeError("Phone number must be in E.164 format");
  }
  return normalized;
}
