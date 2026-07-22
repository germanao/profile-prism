import type { ExtractionDictionary } from "../locales/extraction";
import type { Observation } from "../scoring/evidence-schema";
import { comparableText, elementText, isElementRendered, parseCompactNumber, queryRendered, readField } from "./dom";
import { observed, unavailable } from "./observations";
import { findProfileNameAnchor } from "./top-card";

export interface NetworkCounts {
  connections?: number;
  followers?: number;
}

function findLabeledCount(
  root: ParentNode,
  labels: readonly string[],
  locale: string,
  explicitField: string,
): number | undefined {
  const explicit = readField(root, explicitField);
  if (explicit) return parseCompactNumber(elementText(explicit.element), locale);
  for (const element of queryRendered<HTMLElement>(root, "a, span")) {
    const text = comparableText(elementText(element), locale);
    if (labels.some((label) => text.includes(comparableText(label, locale)))) {
      const count = parseCompactNumber(text, locale);
      if (count !== undefined) return count;
    }
  }
  return undefined;
}

export function extractNetworkMaturity(
  root: ParentNode,
  dictionary: ExtractionDictionary,
  establishedClaim: boolean,
  broadlyThin: boolean,
): Observation<"plausible" | "under_30_established_senior_or_recruiter_with_thin_signal" | "neutral"> {
  const explicitTopCard = root.querySelector<HTMLElement>("[data-pe-top-card], [data-profile-evidence-top-card]");
  const name = findProfileNameAnchor(root);
  const scope = explicitTopCard && isElementRendered(explicitTopCard)
    ? explicitTopCard
    : name?.element.closest<HTMLElement>("section, [role='region']") ?? name?.element.parentElement ?? root;
  const connections = findLabeledCount(scope, dictionary.network.connections, dictionary.locale, "connections");
  const followers = findLabeledCount(scope, dictionary.network.followers, dictionary.locale, "followers");
  if (connections === undefined && followers === undefined) return unavailable("dom:network:counts-not-rendered");
  const value = connections !== undefined && connections < 30 && establishedClaim && broadlyThin
    ? "under_30_established_senior_or_recruiter_with_thin_signal"
    : connections !== undefined && connections >= 30 && establishedClaim && !broadlyThin
      ? "plausible"
      : "neutral";
  return observed(
    value,
    connections !== undefined ? 0.93 : 0.62,
    connections !== undefined ? `dom:network:maturity:${value}` : "dom:network:followers-visible-connections-unavailable-neutral",
  );
}
