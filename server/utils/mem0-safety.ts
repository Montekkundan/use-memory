const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i,
  /\b(?:sk|rk|pk)-(?:live|test)-[A-Za-z0-9_-]{12,}\b/i,
  /\bsk-[A-Za-z0-9_-]{16,}\b/i,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/i,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/i,
  /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/i,
  /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  /[?&](?:access_token|refresh_token|id_token|code)=[^\s&#]+/i,
  /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|password|passcode)\s*(?:is\s+|[:=]\s*)\S+/i,
  /\b(?:otp|one[- ]time (?:password|code)|verification code|security code|login code|authentication code)\s*(?:is\s+|[:=]\s*)?\d{4,8}\b/i,
];

export function containsSensitiveMemoryContent(value: string | null | undefined) {
  if (!value) {
    return false;
  }
  return SECRET_PATTERNS.some(pattern => pattern.test(value));
}

export function safeMemoryText(value: unknown, maxLength = 20_000) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, maxLength);
}
