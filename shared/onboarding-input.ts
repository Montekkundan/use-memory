export function parseOnboardingConsent(text: string) {
  const normalized = text.trim().toLowerCase();
  if (["1", "y", "yes", "continue", "agree"].includes(normalized)) return true;
  if (["2", "n", "no", "stop", "decline"].includes(normalized)) return false;
  return null;
}

export function isIanaTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  }
  catch {
    return false;
  }
}

export function parseNumberedChoices(
  text: string,
  options: readonly string[],
  allowCustom: boolean,
) {
  const normalized = text.trim().toLowerCase();
  if (/^\d+(?:\s*[, ]\s*\d+)*$/u.test(normalized)) {
    const indexes = [...new Set(normalized.split(/[\s,]+/u).map(Number))];
    if (indexes.some(index => index < 1 || index > options.length)) {
      return null;
    }
    return indexes.map(index => options[index - 1]!);
  }

  if (!allowCustom) return null;
  return [...new Set(text.split(",").map(item => item.trim()).filter(Boolean))].slice(0, 12);
}
