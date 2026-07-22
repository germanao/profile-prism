import type { ExtractionDictionary } from "../locales/extraction";
import { comparableText, normalizeVisibleText } from "./dom";
import type { ParsedDateRange, ParsedProfileDate } from "./types";

const YEAR_PATTERN = /\b(19\d{2}|20\d{2}|21\d{2})\b/gu;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function parseLocalizedProfileDate(
  value: string,
  dictionary: ExtractionDictionary,
): ParsedProfileDate | undefined {
  const normalized = comparableText(value, dictionary.locale);
  const yearMatch = Array.from(normalized.matchAll(YEAR_PATTERN))[0];
  const yearText = yearMatch?.[1];
  if (!yearText) return undefined;

  let month: number | undefined;
  for (const [token, monthNumber] of Object.entries(dictionary.date.months)) {
    const pattern = new RegExp(`(?:^|[^\\p{L}])${escapeRegex(token)}\\.?([^\\p{L}]|$)`, "u");
    if (pattern.test(normalized)) {
      month = monthNumber;
      break;
    }
  }
  return { year: Number.parseInt(yearText, 10), ...(month ? { month } : {}) };
}

export function parseLocalizedDateRange(
  value: string,
  dictionary: ExtractionDictionary,
): ParsedDateRange | undefined {
  const normalized = comparableText(value, dictionary.locale);
  const current = dictionary.date.current.some((token) =>
    new RegExp(`(?:^|\\s)${escapeRegex(comparableText(token, dictionary.locale))}(?:$|\\s)`, "u").test(normalized),
  );
  const years = Array.from(normalized.matchAll(YEAR_PATTERN));
  if (years.length === 0) return undefined;

  const splitPattern = new RegExp(
    `\\s+(?:[–—-]|${dictionary.date.rangeSeparators.map(escapeRegex).join("|")})\\s+`,
    "u",
  );
  const portions = normalized.split(splitPattern);
  const start = parseLocalizedProfileDate(portions[0] ?? normalized, dictionary);
  let end: ParsedProfileDate | undefined;
  const finalPortion = portions.at(-1);
  if (!current && portions.length > 1 && finalPortion) end = parseLocalizedProfileDate(finalPortion, dictionary);
  if (!end && !current && years.length > 1) {
    const finalYearText = years.at(-1)?.[1];
    if (finalYearText) end = { year: Number.parseInt(finalYearText, 10) };
  }
  if (!start) return undefined;
  return { start, ...(end ? { end } : {}), current, confidence: start.month || end?.month ? 0.95 : 0.84 };
}

export function profileDateOrdinal(date: ParsedProfileDate): number {
  return date.year * 12 + (date.month ?? 6);
}

export function dateRangeIsContradictory(range: ParsedDateRange): boolean {
  return Boolean(range.start && range.end && profileDateOrdinal(range.end) < profileDateOrdinal(range.start));
}

export function parseRelativeAgeDays(
  value: string,
  dictionary: ExtractionDictionary,
  now: Date,
): number | undefined {
  const normalized = comparableText(value, dictionary.locale);
  const compactUnits: Array<{ units: readonly string[]; multiplier: number }> = [
    { units: dictionary.date.relativeDayUnits, multiplier: 1 },
    { units: dictionary.date.relativeWeekUnits, multiplier: 7 },
    { units: dictionary.date.relativeMonthUnits, multiplier: 30 },
    { units: dictionary.date.relativeYearUnits, multiplier: 365 },
  ];
  for (const { units, multiplier } of compactUnits) {
    for (const unit of [...units].sort((left, right) => right.length - left.length)) {
      const pattern = new RegExp(
        `(?:^|[^\\p{L}\\p{N}])(\\d{1,4})\\s*${escapeRegex(comparableText(unit, dictionary.locale))}(?=$|[^\\p{L}])`,
        "u",
      );
      const match = normalized.match(pattern);
      const count = match?.[1] ? Number.parseInt(match[1], 10) : undefined;
      if (count !== undefined) return count * multiplier;
    }
  }

  const numberMatch = normalized.match(/\b(\d{1,4})\b/u);
  const numberText = numberMatch?.[1];
  if (numberText) {
    const count = Number.parseInt(numberText, 10);
    const has = (units: readonly string[]) => units.some((unit) =>
      new RegExp(`(?:^|\\s)${escapeRegex(unit)}(?:$|[\\s.])`, "u").test(normalized),
    );
    if (has(dictionary.date.relativeDayUnits)) return count;
    if (has(dictionary.date.relativeWeekUnits)) return count * 7;
    if (has(dictionary.date.relativeMonthUnits)) return count * 30;
    if (has(dictionary.date.relativeYearUnits)) return count * 365;
  }

  const parsed = parseLocalizedProfileDate(normalized, dictionary);
  if (!parsed) return undefined;
  const month = (parsed.month ?? 1) - 1;
  const date = Date.UTC(parsed.year, month, 1);
  const current = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (date > current) return undefined;
  return Math.round((current - date) / 86_400_000);
}

export function parseMemberSinceDays(
  value: string,
  dictionary: ExtractionDictionary,
  now: Date,
): number | undefined {
  const text = normalizeVisibleText(value);
  const normalized = comparableText(text, dictionary.locale);
  if (!dictionary.profile.memberSince.some((prefix) => normalized.includes(comparableText(prefix, dictionary.locale)))) {
    return undefined;
  }
  const parsed = parseLocalizedProfileDate(text, dictionary);
  if (!parsed) return undefined;
  const joined = Date.UTC(parsed.year, (parsed.month ?? 1) - 1, 1);
  const current = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (joined > current) return undefined;
  return Math.floor((current - joined) / 86_400_000);
}
