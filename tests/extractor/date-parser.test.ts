import { describe, expect, it } from "vitest";
import { getExtractionDictionary } from "../../src/locales/extraction";
import {
  dateRangeIsContradictory,
  parseLocalizedDateRange,
  parseMemberSinceDays,
  parseRelativeAgeDays,
} from "../../src/extractors/date-parser";
import { normalizeVisibleText, parseCompactNumber } from "../../src/extractors/dom";

describe("localized extraction primitives", () => {
  const now = new Date("2026-07-16T12:00:00Z");

  it.each([
    ["en", "January 2022 - Present", 2022, 1, true],
    ["pt", "mar de 2018 - dez de 2021", 2018, 3, false],
    ["es", "ene 2025 - actualidad", 2025, 1, true],
  ] as const)("parses %s date ranges", (locale, text, year, month, current) => {
    const parsed = parseLocalizedDateRange(text, getExtractionDictionary(locale));
    expect(parsed?.start).toEqual({ year, month });
    expect(parsed?.current).toBe(current);
  });

  it("recognizes a materially reversed localized date range", () => {
    const range = parseLocalizedDateRange("dic 2023 - ene 2021", getExtractionDictionary("es"));
    expect(range).toBeDefined();
    expect(dateRangeIsContradictory(range!)).toBe(true);
  });

  it.each([
    ["en", "2 days ago", 2],
    ["en", "1mo", 30],
    ["pt", "há 3 semanas", 21],
    ["es", "hace 4 meses", 120],
  ] as const)("parses %s relative dates", (locale, text, expectedDays) => {
    expect(parseRelativeAgeDays(text, getExtractionDictionary(locale), now)).toBe(expectedDays);
  });

  it("parses member-since text only when the localized label is explicit", () => {
    const dictionary = getExtractionDictionary("pt");
    expect(parseMemberSinceDays("Membro desde maio de 2026", dictionary, now)).toBeGreaterThan(60);
    expect(parseMemberSinceDays("maio de 2026", dictionary, now)).toBeUndefined();
  });

  it("rejects a future member-since date instead of treating it as a new account", () => {
    const dictionary = getExtractionDictionary("en");
    expect(parseMemberSinceDays("Member since December 2026", dictionary, now)).toBeUndefined();
  });

  it("normalizes whitespace without stripping semantic accents", () => {
    expect(normalizeVisibleText("  Formação\u00a0 acadêmica  ")).toBe("Formação acadêmica");
  });

  it.each([
    ["486 connections", "en", 486],
    ["1,240 followers", "en", 1240],
    ["1.240 seguidores", "pt", 1240],
    ["2,5 mil", "pt", 2500],
    ["2.5k followers", "en", 2500],
    ["500+ connections", "en", 500],
  ] as const)("parses visible count %s", (text, locale, count) => {
    // Both compact k/m and the EN/PT/ES `mil` form are deterministic.
    expect(parseCompactNumber(text, locale)).toBe(count);
  });
});
