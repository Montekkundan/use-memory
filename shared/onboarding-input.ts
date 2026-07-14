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

const HUMAN_TIMEZONE_ALIASES = new Map<string, string>([
  ["calgary", "America/Edmonton"],
  ["calgary canada", "America/Edmonton"],
  ["chicago", "America/Chicago"],
  ["denver", "America/Denver"],
  ["edmonton", "America/Edmonton"],
  ["edmonton canada", "America/Edmonton"],
  ["eastern canada", "America/Toronto"],
  ["eastern time", "America/Toronto"],
  ["halifax", "America/Halifax"],
  ["halifax canada", "America/Halifax"],
  ["india", "Asia/Kolkata"],
  ["kolkata", "Asia/Kolkata"],
  ["london", "Europe/London"],
  ["london uk", "Europe/London"],
  ["los angeles", "America/Los_Angeles"],
  ["montreal", "America/Toronto"],
  ["montreal canada", "America/Toronto"],
  ["mumbai", "Asia/Kolkata"],
  ["new delhi", "Asia/Kolkata"],
  ["new york", "America/New_York"],
  ["ottawa", "America/Toronto"],
  ["ottawa canada", "America/Toronto"],
  ["paris", "Europe/Paris"],
  ["san francisco", "America/Los_Angeles"],
  ["st johns", "America/St_Johns"],
  ["st johns canada", "America/St_Johns"],
  ["sydney", "Australia/Sydney"],
  ["tokyo", "Asia/Tokyo"],
  ["toronto", "America/Toronto"],
  ["toronto canada", "America/Toronto"],
  ["utc", "UTC"],
  ["vancouver", "America/Vancouver"],
  ["vancouver canada", "America/Vancouver"],
  ["winnipeg", "America/Winnipeg"],
  ["winnipeg canada", "America/Winnipeg"],
]);

function normalizeHumanTimezone(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(?:i live in|i am in|i'm in|my timezone is|timezone is)\b/gu, " ")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function resolveTimezoneInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (isIanaTimezone(trimmed)) {
    return new Intl.DateTimeFormat("en-US", { timeZone: trimmed })
      .resolvedOptions()
      .timeZone;
  }

  const normalized = normalizeHumanTimezone(trimmed);
  const alias = HUMAN_TIMEZONE_ALIASES.get(normalized);
  if (alias) return alias;

  const supportedValues = typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : [];
  return supportedValues.find(timezone => timezone.toLowerCase() === trimmed.toLowerCase()) ?? null;
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
