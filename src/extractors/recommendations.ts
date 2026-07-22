import type { ExtractionDictionary } from "../locales/extraction";
import type { Observation } from "../scoring/evidence-schema";
import {
  elementText,
  findSection,
  readField,
  renderedTextSegments,
  sectionItems,
  similarText,
  tokenize,
} from "./dom";
import { absent, observed, unavailable } from "./observations";

const REPEATED_SIMILARITY_THRESHOLD = 0.82;

function isMeaningfulRecommendation(text: string, locale: string): boolean {
  return text.length >= 40 && tokenize(text, locale).length >= 6;
}

/** Requires three mutually similar recommendations, not one similar pair. */
function hasRepeatedSet(texts: readonly string[], locale: string): boolean {
  if (texts.length < 3) return false;
  for (let first = 0; first < texts.length - 2; first += 1) {
    const firstText = texts[first];
    if (!firstText) continue;
    for (let second = first + 1; second < texts.length - 1; second += 1) {
      const secondText = texts[second];
      if (
        !secondText ||
        similarText(firstText, secondText, locale) < REPEATED_SIMILARITY_THRESHOLD
      ) {
        continue;
      }
      for (let third = second + 1; third < texts.length; third += 1) {
        const thirdText = texts[third];
        if (
          thirdText &&
          similarText(firstText, thirdText, locale) >= REPEATED_SIMILARITY_THRESHOLD &&
          similarText(secondText, thirdText, locale) >= REPEATED_SIMILARITY_THRESHOLD
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

export function extractRecommendations(
  root: ParentNode,
  dictionary: ExtractionDictionary,
): Observation<"several_specific_across_people_and_time" | "some" | "repeated_boilerplate" | "neutral"> {
  const section = findSection(root, "recommendations", dictionary);
  if (!section) return unavailable("dom:recommendations:not-rendered");
  if (section.explicitlyEmpty) return absent(section.confidence, "dom:recommendations:explicit-empty");
  const items = sectionItems(section.element);
  if (items.length === 0) {
    const flatTexts = renderedTextSegments(section.element)
      .filter((text) => isMeaningfulRecommendation(text, dictionary.locale));
    if (flatTexts.length === 0) return unavailable("dom:recommendations:partial-or-not-loaded");
    const value = hasRepeatedSet(flatTexts, dictionary.locale) ? "repeated_boilerplate" : "some";
    return observed(value, section.confidence * 0.68, `dom:recommendations:flat-visible:${value}`);
  }
  const meaningfulItems = items
    .map((item) => ({
      item,
      text: elementText(readField(item, "content", ["blockquote", "p"])?.element ?? item),
    }))
    .filter(({ text }) => isMeaningfulRecommendation(text, dictionary.locale));
  if (meaningfulItems.length === 0) {
    return unavailable("dom:recommendations:meaningful-content-not-rendered");
  }
  const texts = meaningfulItems.map(({ text }) => text);
  const specificCount = texts.filter((text) => text.length >= 80 && /\b\d+%?|[A-Z][A-Za-z0-9+#.-]{2,}/u.test(text)).length;
  const authors = new Set(meaningfulItems.map(({ item }) => readField(item, "author", ["cite", "h3"])?.element)
    .map(elementText)
    .filter(Boolean));
  const datedCount = meaningfulItems.filter(({ item }) => Boolean(readField(item, "date", ["time", "[data-field='date']"]))).length;
  const repeated = hasRepeatedSet(texts, dictionary.locale);
  const value = repeated
    ? "repeated_boilerplate"
    : specificCount >= 3 && authors.size >= 3 && datedCount >= 2
      ? "several_specific_across_people_and_time"
      : meaningfulItems.length >= 1
        ? "some"
        : "neutral";
  return observed(value, section.confidence * (value === "some" ? 0.82 : 0.92), `dom:recommendations:${value}`);
}
