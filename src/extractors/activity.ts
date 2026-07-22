import type { ExtractionDictionary } from "../locales/extraction";
import { parseRelativeAgeDays } from "./date-parser";
import {
  comparableText,
  elementText,
  findSection,
  queryRendered,
  readField,
  renderedTextSegments,
  sectionItems,
  similarText,
} from "./dom";
import { absent, observed, unavailable } from "./observations";
import type { ActivityFacts } from "./types";

interface ActivityItem {
  text: string;
  ageDays?: number;
}

interface ReciprocalItem extends ActivityItem {
  ageDays?: number;
}

const RECIPROCAL_SELECTORS = [
  "[data-pe-engagement='reciprocal']",
  "[data-profile-evidence-engagement='reciprocal']",
  "[aria-label*='replied to' i]",
  "[aria-label*='reply to' i]",
  "[aria-label*='respondeu a' i]",
  "[aria-label*='resposta a' i]",
  "[aria-label*='respondió a' i]",
  "[aria-label*='respuesta a' i]",
].join(", ");

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function looksLikeActivityDate(text: string, dictionary: ExtractionDictionary): boolean {
  if (text.length > 160 || /(?:[$€£]|r\$)\s*\d+\s*[kmb]\b/iu.test(text)) return false;
  const normalized = comparableText(text, dictionary.locale);
  const units = [
    ...dictionary.date.relativeDayUnits,
    ...dictionary.date.relativeWeekUnits,
    ...dictionary.date.relativeMonthUnits,
    ...dictionary.date.relativeYearUnits,
  ].sort((left, right) => right.length - left.length);
  return units.some((unit) => new RegExp(
    `(?:^|[\\s\\u00b7\\u2022])(\\d{1,3})\\s*${escapeRegex(comparableText(unit, dictionary.locale))}(?=$|[\\s.\\u00b7\\u2022])`,
    "u",
  ).test(normalized));
}

function flatActivityItems(
  section: HTMLElement,
  dictionary: ExtractionDictionary,
  now: Date,
): ActivityItem[] {
  const segments = renderedTextSegments(section);
  return segments.flatMap((segment, index) => {
    if (!looksLikeActivityDate(segment, dictionary)) return [];
    const ageDays = parseRelativeAgeDays(segment, dictionary, now);
    if (ageDays === undefined) return [];
    const context = [segments[index - 1], segments[index + 1]]
      .filter((value): value is string => Boolean(value && value !== segment && value.length <= 500))
      .join(" ");
    return [{ text: context || segment, ageDays }];
  });
}

function minimumPairSimilarity(items: readonly ActivityItem[], locale: string): number {
  if (items.length < 2) return 0;
  let minimum = 1;
  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      const leftItem = items[left];
      const rightItem = items[right];
      if (leftItem && rightItem) {
        minimum = Math.min(minimum, similarText(leftItem.text, rightItem.text, locale));
      }
    }
  }
  return minimum;
}

function maximumPairSimilarity(items: readonly ActivityItem[], locale: string): number {
  let maximum = 0;
  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      const leftItem = items[left];
      const rightItem = items[right];
      if (leftItem && rightItem) {
        maximum = Math.max(maximum, similarText(leftItem.text, rightItem.text, locale));
      }
    }
  }
  return maximum;
}

function extractActivityItem(item: HTMLElement, dictionary: ExtractionDictionary, now: Date): ActivityItem {
  const dateMatch = readField(item, "date", ["time", "[data-field='date']", "[aria-label*='ago' i]"]);
  const dateText = dateMatch ? `${elementText(dateMatch.element)} ${dateMatch.element.getAttribute("datetime") ?? ""}` : "";
  const content = readField(item, "content", ["[data-field='content']", "p"]);
  const ageDays = dateText ? parseRelativeAgeDays(dateText, dictionary, now) : undefined;
  return {
    text: elementText(content?.element ?? item),
    ...(ageDays === undefined ? {} : { ageDays }),
  };
}

function extractReciprocalItem(
  element: HTMLElement,
  dictionary: ExtractionDictionary,
  now: Date,
): ReciprocalItem | undefined {
  if (element.matches("button, [role='button']")) return undefined;
  const text = elementText(element);
  if (text.length < 8) return undefined;
  const date = readField(element, "date", ["time", "[data-field='date']"]);
  const dateText = date ? `${elementText(date.element)} ${date.element.getAttribute("datetime") ?? ""}` : "";
  const ageDays = dateText ? parseRelativeAgeDays(dateText, dictionary, now) : undefined;
  return { text, ...(ageDays === undefined ? {} : { ageDays }) };
}

export function extractActivityFacts(
  root: ParentNode,
  dictionary: ExtractionDictionary,
  now: Date,
  broadlyThin: boolean,
): ActivityFacts {
  const section = findSection(root, "activity", dictionary);
  if (!section) {
    return {
      distribution: unavailable("dom:activity:not-rendered"),
      engagement: unavailable("dom:activity:not-rendered"),
    };
  }
  if (section.explicitlyEmpty) {
    return {
      distribution: absent(section.confidence, "dom:activity:explicit-empty"),
      engagement: absent(section.confidence, "dom:activity:explicit-empty"),
    };
  }

  const semanticItems = sectionItems(section.element).map((item) => extractActivityItem(item, dictionary, now));
  const flatItems = flatActivityItems(section.element, dictionary, now);
  const semanticDatedCount = semanticItems.filter((item) => item.ageDays !== undefined).length;
  const flatDatedCount = flatItems.filter((item) => item.ageDays !== undefined).length;
  const items = flatDatedCount > semanticDatedCount ? flatItems : semanticItems.length > 0 ? semanticItems : flatItems;
  if (items.length === 0) {
    return {
      distribution: unavailable("dom:activity:partial-or-not-loaded"),
      engagement: unavailable("dom:activity:partial-or-not-loaded"),
    };
  }

  const dated = items.filter((item): item is ActivityItem & { ageDays: number } => item.ageDays !== undefined);
  if (dated.length < 2) {
    return {
      distribution: unavailable("dom:activity:fewer-than-two-parseable-visible-dates"),
      engagement: extractReciprocalEngagement(section.element, dictionary, now, section.confidence),
    };
  }
  const oldest = dated.length ? Math.max(...dated.map((item) => item.ageDays)) : 0;
  const newest = dated.length ? Math.min(...dated.map((item) => item.ageDays)) : 0;
  const burst = dated.length >= 3 && oldest <= 30 && minimumPairSimilarity(dated, dictionary.locale) >= 0.78;
  const distributionValue = dated.length >= 3 && oldest - newest >= 730
    ? "distributed_over_years"
    : dated.length >= 2 && oldest - newest >= 180
      ? "at_least_six_months"
      : burst && broadlyThin
        ? "sudden_near_duplicate_burst_with_thin_signal"
        : "neutral";

  return {
    distribution: observed(
      distributionValue,
      section.confidence * 0.9 * (dated.length / items.length),
      `dom:activity:distribution:${distributionValue}`,
    ),
    engagement: extractReciprocalEngagement(section.element, dictionary, now, section.confidence),
  };
}

function extractReciprocalEngagement(
  section: HTMLElement,
  dictionary: ExtractionDictionary,
  now: Date,
  confidence: number,
): ActivityFacts["engagement"] {
  const exchanges = queryRendered<HTMLElement>(section, RECIPROCAL_SELECTORS)
    .map((element) => extractReciprocalItem(element, dictionary, now))
    .filter((item): item is ReciprocalItem => Boolean(item));
  if (exchanges.length < 2) {
    return unavailable("dom:activity:reciprocal-evidence-not-rendered-or-insufficient");
  }

  const repeated = exchanges.length >= 3 && minimumPairSimilarity(exchanges, dictionary.locale) >= 0.8;
  const dated = exchanges.filter((item): item is ReciprocalItem & { ageDays: number } => item.ageDays !== undefined);
  const exchangeSpan = dated.length >= 2
    ? Math.max(...dated.map((item) => item.ageDays)) - Math.min(...dated.map((item) => item.ageDays))
    : 0;
  const varied = exchanges.length >= 4 && maximumPairSimilarity(exchanges, dictionary.locale) < 0.72 && exchangeSpan >= 180;
  const value = repeated
    ? "repeated_generic_pattern"
    : varied
      ? "varied_specific_over_time"
      : "some_genuine_exchange";
  return observed(value, confidence * 0.78, `dom:activity:engagement:${value}`);
}
