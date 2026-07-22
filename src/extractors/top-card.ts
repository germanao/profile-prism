import type { ExtractionDictionary } from "../locales/extraction";
import type { Observation } from "../scoring/evidence-schema";
import { parseMemberSinceDays } from "./date-parser";
import {
  comparableText,
  elementText,
  firstRendered,
  isElementRendered,
  meaningfulSectionText,
  normalizeVisibleText,
  queryRendered,
  readField,
} from "./dom";
import { findCurrentCompanyMatch, findTopCardScope } from "./current-company";
import { absent, observed, unavailable } from "./observations";
import type { ElementMatch, TopCardFacts } from "./types";
import { findSection } from "./dom";

export function findProfileNameAnchor(root: ParentNode): ElementMatch<HTMLElement> | undefined {
  const document = (root as Document).documentElement
    ? root as Document
    : (root as Node).ownerDocument;
  const currentPath = document?.location.pathname.replace(/\/+$/u, "") || "";
  if (/^\/in\/[^/]+$/u.test(currentPath)) {
    for (const heading of queryRendered<HTMLElement>(root, "main a[href] h1, main a[href] h2, [role='main'] a[href] h1, [role='main'] a[href] h2")) {
      const link = heading.closest<HTMLAnchorElement>("a[href]");
      if (!link) continue;
      try {
        const path = new URL(link.href, document?.location.href).pathname.replace(/\/+$/u, "");
        if (path === currentPath) {
          return { element: heading, confidence: 0.98, source: "dom:top-card:name:current-profile-link" };
        }
      } catch {
        // Ignore malformed page-owned hrefs and continue with semantic fallbacks.
      }
    }
  }

  return firstRendered<HTMLElement>(root, [
    "[data-pe-field='name']",
    "[data-profile-evidence-field='name']",
    "main h1",
    "[role='main'] h1",
    "main a[href*='/in/'] h2",
    "[role='main'] a[href*='/in/'] h2",
    "a[href*='/in/'] h2",
    "h1",
  ]);
}

function readTextObservation(
  match: ElementMatch | undefined,
  source: string,
): Observation<string> {
  if (!match) return unavailable(source);
  const value = elementText(match.element);
  return value ? observed(value, match.confidence, source) : unavailable(`${source}:empty-node`);
}

function readHeadline(topCard: ParentNode | undefined): ElementMatch | undefined {
  if (!topCard) return undefined;
  const explicit = readField(topCard, "headline", [
    "[aria-label^='Headline:' i]",
    "[data-field='headline']",
    "[data-generated-suggestion-target]",
    ".text-body-medium.break-words",
  ]);
  if (explicit) return explicit;

  const heading = findProfileNameAnchor(topCard)?.element ?? topCard.querySelector("h1");
  if (!heading) return undefined;
  for (const sibling of Array.from(heading.parentElement?.children ?? [])) {
    if (sibling === heading || !isElementRendered(sibling)) continue;
    const text = elementText(sibling);
    if (text.length >= 8 && text.length <= 300 && !sibling.matches("button, nav")) {
      return { element: sibling as HTMLElement, confidence: 0.72, source: "dom:top-card:headline:sibling" };
    }
  }

  const nameLink = heading.closest("a[href]");
  const nameText = elementText(heading);
  const genericCandidates = queryRendered<HTMLElement>(topCard, "p, div, span[aria-hidden='true']");
  for (const candidate of genericCandidates) {
    if (candidate === heading || heading.contains(candidate) || nameLink?.contains(candidate)) continue;
    if (candidate.matches("button, nav, [role='button']") || candidate.closest("button, nav, [role='button']")) continue;
    if (candidate.querySelector("h1, h2, h3, section, nav, button, [role='button']")) continue;
    const directText = normalizeVisibleText(
      Array.from(candidate.childNodes)
        .filter((node) => node.nodeType === 3)
        .map((node) => node.textContent ?? "")
        .join(" "),
    );
    const text = directText || elementText(candidate);
    if (!text || text === nameText || text.length < 8 || text.length > 300) continue;
    if (/\b(?:connections?|followers?|contact info|profile photo|verifications?)\b/iu.test(text)) continue;
    return { element: candidate, confidence: 0.68, source: "dom:top-card:headline:first-semantic-text" };
  }
  return undefined;
}

function readAccountAge(
  root: ParentNode,
  topCard: ParentNode | undefined,
  dictionary: ExtractionDictionary,
  now: Date,
): Observation<{ days: number }> {
  const explicit = readField(root, "member-since");
  const candidates = explicit
    ? [explicit.element]
    : queryRendered<HTMLElement>(topCard ?? root, "time, [aria-label], span, p").filter((element) => {
      const text = `${elementText(element)} ${element.getAttribute("aria-label") ?? ""}`;
      return dictionary.profile.memberSince.some((prefix) =>
        comparableText(text, dictionary.locale).includes(comparableText(prefix, dictionary.locale)),
      );
    });

  for (const candidate of candidates) {
    const text = `${elementText(candidate)} ${candidate.getAttribute("aria-label") ?? ""}`;
    const days = parseMemberSinceDays(text, dictionary, now);
    if (days !== undefined) {
      return observed({ days }, explicit ? 1 : 0.84, "dom:top-card:member-since");
    }
  }
  return unavailable("dom:top-card:member-since:not-rendered");
}

function readProfileImage(
  topCard: ParentNode | undefined,
  dictionary: ExtractionDictionary,
): Observation<"personal" | "default_or_non_person" | "none"> {
  if (!topCard) return unavailable("dom:top-card:image:no-top-card");
  const explicitNone = topCard.querySelector(
    "[data-pe-field='profile-image'][data-state='absent'], [data-profile-evidence-image='none']",
  );
  if (explicitNone) return observed("none", 1, "dom:top-card:image:explicit-none");

  const image = firstRendered<HTMLImageElement>(topCard, [
    "img[data-pe-field='profile-image']",
    "img[data-profile-evidence-field='profile-image']",
    "img[data-field='profile-photo']",
    "[data-view-name='profile-photo'] img",
    "[aria-label*='profile photo' i] img",
    "[aria-label*='foto de perfil' i] img",
    "a[href*='/overlay/photo/'] img",
    "a[href*='/overlay/profile-photo/'] img",
    "img.pv-top-card-profile-picture__image--show",
    "img.pv-top-card-profile-picture__image",
    "img.profile-photo-edit__preview",
  ]);
  if (!image) return unavailable("dom:top-card:image:not-rendered");

  const descriptor = comparableText(
    `${image.element.alt} ${image.element.title} ${image.element.getAttribute("data-image-kind") ?? ""}`,
    dictionary.locale,
  );
  const isDefault =
    image.element.getAttribute("data-image-kind") === "default" ||
    dictionary.profile.defaultImageText.some((token) => descriptor.includes(comparableText(token, dictionary.locale)));
  return observed(isDefault ? "default_or_non_person" : "personal", image.confidence, "dom:top-card:image:attribute-only");
}

export function extractTopCardFacts(
  root: ParentNode,
  dictionary: ExtractionDictionary,
  now: Date,
): TopCardFacts {
  const nameAnchor = findProfileNameAnchor(root);
  const topCard = findTopCardScope(root, nameAnchor?.element);
  const aboutSection = findSection(root, "about", dictionary);
  const aboutText = aboutSection && !aboutSection.explicitlyEmpty ? meaningfulSectionText(aboutSection.element) : "";
  const about = aboutSection
    ? aboutSection.explicitlyEmpty
      ? absent<string>(aboutSection.confidence, "dom:about:explicit-empty")
      : aboutText
        ? observed(aboutText, aboutSection.confidence, "dom:about:visible-text")
        : unavailable<string>("dom:about:partial-or-not-loaded")
    : unavailable<string>("dom:about:not-rendered");

  return {
    name: readTextObservation(nameAnchor, "dom:top-card:name"),
    headline: readTextObservation(readHeadline(topCard), "dom:top-card:headline"),
    about,
    currentCompany: readTextObservation(
      findCurrentCompanyMatch(topCard, nameAnchor?.element),
      "dom:top-card:current-company",
    ),
    accountAge: readAccountAge(root, topCard, dictionary, now),
    imageKind: readProfileImage(topCard, dictionary),
  };
}
