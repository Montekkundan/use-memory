export function isIanaTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  }
  catch {
    return false;
  }
}

export function resolveTimezoneInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (isIanaTimezone(trimmed)) {
    return new Intl.DateTimeFormat("en-US", { timeZone: trimmed })
      .resolvedOptions()
      .timeZone;
  }

  const supportedValues = typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : [];
  return supportedValues.find(timezone => timezone.toLowerCase() === trimmed.toLowerCase()) ?? null;
}
