import type { ExtractionDictionary, SectionKey } from "../locales/extraction";
import type { ElementMatch, SectionMatch } from "./types";

const SECTION_SELECTOR = "section, [role='region'], [data-pe-section], [data-profile-evidence-section]";
const HEADING_SELECTOR = "h2, h3, [role='heading'][aria-level='2'], [role='heading'][aria-level='3']";
const SCREEN_READER_ONLY_CLASSES = new Set([
  "a11y-text",
  "screen-reader-text",
  "sr-only",
  "visually-hidden",
]);

interface DomReadSession {
  readonly rendered: WeakMap<Element, boolean>;
  readonly text: WeakMap<Element, string>;
  readonly queries: WeakMap<ParentNode, Map<string, readonly Element[]>>;
  readonly sections: WeakMap<ParentNode, Map<string, SectionMatch | null>>;
  readonly sectionText: WeakMap<Element, string>;
  readonly sectionItems: WeakMap<Element, readonly HTMLElement[]>;
  readonly textSegments: WeakMap<ParentNode, readonly string[]>;
}

let activeDomReadSession: DomReadSession | null = null;

/**
 * Shares DOM reads for one synchronous extraction. The cache never survives a
 * mutation turn, so LinkedIn visibility and content changes cannot become
 * stale between refreshes.
 */
export function withDomReadSession<T>(operation: () => T): T {
  const parent = activeDomReadSession;
  if (parent) return operation();
  activeDomReadSession = {
    rendered: new WeakMap(),
    text: new WeakMap(),
    queries: new WeakMap(),
    sections: new WeakMap(),
    sectionText: new WeakMap(),
    sectionItems: new WeakMap(),
    textSegments: new WeakMap(),
  };
  try {
    return operation();
  } finally {
    activeDomReadSession = null;
  }
}

export function normalizeVisibleText(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").replace(/\u00a0/gu, " ").replace(/\s+/gu, " ").trim();
}

export function comparableText(value: string | null | undefined, locale = "en"): string {
  return normalizeVisibleText(value).toLocaleLowerCase(locale);
}

export function elementText(element: Element | null | undefined): string {
  if (!element || !isElementRendered(element)) return "";
  const cached = activeDomReadSession?.text.get(element);
  if (cached !== undefined) return cached;

  const fragments: string[] = [];
  for (const node of element.childNodes) {
    if (node.nodeType === 3) {
      fragments.push(node.textContent ?? "");
      continue;
    }
    if (node.nodeType !== 1) continue;
    const child = node as Element;
    if (child.matches("script, style, template, noscript")) continue;
    if (isElementRendered(child)) fragments.push(elementText(child));
  }
  const text = normalizeVisibleText(fragments.join(" "));
  activeDomReadSession?.text.set(element, text);
  return text;
}

function isHiddenByClosedContainer(element: Element): boolean {
  for (let current = element.parentElement; current; current = current.parentElement) {
    if (current.tagName === "DIALOG" && !current.hasAttribute("open")) return true;
    if (current.tagName !== "DETAILS" || current.hasAttribute("open")) continue;
    const summary = Array.from(current.children).find((child) => child.tagName === "SUMMARY");
    if (!summary?.contains(element)) return true;
  }
  return element.tagName === "DIALOG" && !element.hasAttribute("open");
}

function hasScreenReaderOnlyClass(element: Element): boolean {
  return Array.from(element.classList).some((className) => SCREEN_READER_ONLY_CLASSES.has(className));
}

function isVisuallyClipped(style: CSSStyleDeclaration): boolean {
  const clip = style.clip.replace(/\s+/gu, "").toLocaleLowerCase();
  const clipPath = style.clipPath.replace(/\s+/gu, "").toLocaleLowerCase();
  if (clip === "rect(0px,0px,0px,0px)" || clip === "rect(0,0,0,0)") return true;
  if (clipPath === "inset(50%)" || clipPath === "inset(100%)") return true;

  const width = Number.parseFloat(style.width);
  const height = Number.parseFloat(style.height);
  return (style.position === "absolute" || style.position === "fixed") &&
    Number.isFinite(width) && width <= 1 &&
    Number.isFinite(height) && height <= 1 &&
    style.overflow === "hidden";
}

export function isElementRendered(element: Element): boolean {
  const session = activeDomReadSession;
  const cached = session?.rendered.get(element);
  if (cached !== undefined) return cached;
  if (isHiddenByClosedContainer(element)) {
    session?.rendered.set(element, false);
    return false;
  }
  const visited: Element[] = [];
  for (let current: Element | null = element; current; current = current.parentElement) {
    const ancestorCached = session?.rendered.get(current);
    if (ancestorCached !== undefined) {
      visited.forEach((candidate) => session?.rendered.set(candidate, ancestorCached));
      return ancestorCached;
    }
    visited.push(current);
    if (current.hasAttribute("hidden") || hasScreenReaderOnlyClass(current)) {
      visited.forEach((candidate) => session?.rendered.set(candidate, false));
      return false;
    }
    const style = current.getAttribute("style")?.replace(/\s+/gu, "").toLocaleLowerCase();
    if (
      style?.includes("display:none") ||
      style?.includes("visibility:hidden") ||
      style?.includes("visibility:collapse") ||
      style?.includes("opacity:0") ||
      style?.includes("content-visibility:hidden")
    ) {
      visited.forEach((candidate) => session?.rendered.set(candidate, false));
      return false;
    }
    const view = current.ownerDocument.defaultView;
    if (view && current.isConnected) {
      const computed = view.getComputedStyle(current);
      if (
        computed.display === "none" ||
        computed.visibility === "hidden" ||
        computed.visibility === "collapse" ||
        computed.opacity === "0" ||
        computed.contentVisibility === "hidden" ||
        isVisuallyClipped(computed)
      ) {
        visited.forEach((candidate) => session?.rendered.set(candidate, false));
        return false;
      }
    }
  }
  visited.forEach((candidate) => session?.rendered.set(candidate, true));
  return true;
}

export function queryRendered<T extends Element = HTMLElement>(root: ParentNode, selector: string): T[] {
  const session = activeDomReadSession;
  let queries = session?.queries.get(root);
  if (!queries && session) {
    queries = new Map();
    session.queries.set(root, queries);
  }
  const cached = queries?.get(selector);
  if (cached) return [...cached] as T[];
  const elements = Array.from(root.querySelectorAll<T>(selector)).filter(isElementRendered);
  queries?.set(selector, elements);
  return [...elements];
}

export function firstRendered<T extends Element = HTMLElement>(
  root: ParentNode,
  selectors: readonly string[],
): ElementMatch<T> | undefined {
  for (let index = 0; index < selectors.length; index += 1) {
    const selector = selectors[index];
    if (!selector) continue;
    const element = root.querySelector(selector) as T | null;
    if (element && isElementRendered(element)) {
      return {
        element,
        confidence: Math.max(0.72, 1 - index * 0.08),
        source: `dom:selector:${index + 1}`,
      };
    }
  }
  return undefined;
}

function labelsMatch(value: string, labels: readonly string[], locale: string): boolean {
  const normalized = comparableText(value, locale).replace(/[:：]$/u, "").trim();
  return labels.some((label) => normalized === comparableText(label, locale));
}

function explicitSection(root: ParentNode, key: SectionKey): HTMLElement | undefined {
  const candidates = queryRendered<HTMLElement>(
    root,
    `[data-pe-section='${key}'], [data-profile-evidence-section='${key}']`,
  );
  return candidates[0];
}

function isKnownSectionHeading(
  heading: HTMLElement,
  dictionary: ExtractionDictionary,
): boolean {
  return Object.values(dictionary.sectionLabels).some((labels) =>
    labelsMatch(elementText(heading), labels, dictionary.locale),
  );
}

/**
 * Some LinkedIn experiments use nested presentation divs for the entire card,
 * not only for its rows. Choose the nearest bounded ancestor that contains
 * substantive content and does not cross into another recognized card.
 */
function inferDivCardContainer(
  heading: HTMLElement,
  dictionary: ExtractionDictionary,
): HTMLElement | undefined {
  let current = heading.parentElement;
  for (let depth = 0; current && depth < 7; depth += 1, current = current.parentElement) {
    if (current.matches("main, [role='main'], body, html")) break;
    const knownHeadings = queryRendered<HTMLElement>(current, HEADING_SELECTOR)
      .filter((candidate) => isKnownSectionHeading(candidate, dictionary));
    if (knownHeadings.length > 1) break;
    if (meaningfulSectionText(current).length >= 12) return current;
  }
  return heading.parentElement ?? undefined;
}

export function isExplicitlyEmpty(
  section: Element,
  key: SectionKey,
  dictionary: ExtractionDictionary,
): boolean {
  if (
    section.matches("[data-pe-empty='true'], [data-profile-evidence-state='absent']") ||
    section.querySelector("[data-pe-empty='true'], [data-profile-evidence-state='absent']")
  ) {
    return true;
  }

  const text = comparableText(elementText(section), dictionary.locale);
  const phrases = [...(dictionary.emptyStateText[key] ?? []), ...(dictionary.emptyStateText.generic ?? [])];
  if (phrases.some((phrase) => text.includes(comparableText(phrase, dictionary.locale)))) return true;
  if (key === "recommendations") {
    return /haven.t received (?:any |a )?recommendation/iu.test(text) ||
      /n\p{L}o.{0,60}recebeu.{0,40}recomenda/iu.test(text) ||
      /no ha recibido.{0,40}recomenda/iu.test(text);
  }
  return false;
}

function findSectionUncached(
  root: ParentNode,
  key: SectionKey,
  dictionary: ExtractionDictionary,
): SectionMatch | undefined {
  const explicit = explicitSection(root, key);
  if (explicit) {
    return {
      element: explicit,
      confidence: 1,
      source: `dom:section:${key}:data-marker`,
      explicitlyEmpty: isExplicitlyEmpty(explicit, key, dictionary),
    };
  }

  const labels = dictionary.sectionLabels[key];
  for (const section of queryRendered<HTMLElement>(root, SECTION_SELECTOR)) {
    const accessibleLabel = section.getAttribute("aria-label") ?? section.getAttribute("data-section-label") ?? "";
    if (labelsMatch(accessibleLabel, labels, dictionary.locale)) {
      return {
        element: section,
        confidence: 0.93,
        source: `dom:section:${key}:aria-label`,
        explicitlyEmpty: isExplicitlyEmpty(section, key, dictionary),
      };
    }
  }

  for (const heading of queryRendered<HTMLElement>(root, HEADING_SELECTOR)) {
    if (!labelsMatch(elementText(heading), labels, dictionary.locale)) continue;
    const containingSection = heading.closest<HTMLElement>(SECTION_SELECTOR);
    const container = containingSection ?? inferDivCardContainer(heading, dictionary);
    if (!container || !isElementRendered(container)) continue;
    return {
      element: container,
      confidence: containingSection ? 0.88 : 0.76,
      source: containingSection
        ? `dom:section:${key}:heading`
        : `dom:section:${key}:div-card-heading`,
      explicitlyEmpty: isExplicitlyEmpty(container, key, dictionary),
    };
  }

  return undefined;
}

export function findSection(
  root: ParentNode,
  key: SectionKey,
  dictionary: ExtractionDictionary,
): SectionMatch | undefined {
  const cacheKey = `${dictionary.locale}:${key}`;
  const session = activeDomReadSession;
  let sections = session?.sections.get(root);
  if (!sections && session) {
    sections = new Map();
    session.sections.set(root, sections);
  }
  if (sections?.has(cacheKey)) return sections.get(cacheKey) ?? undefined;
  const result = findSectionUncached(root, key, dictionary);
  sections?.set(cacheKey, result ?? null);
  return result;
}

export function sectionItems(section: Element): HTMLElement[] {
  const cached = activeDomReadSession?.sectionItems.get(section);
  if (cached) return [...cached];
  const explicit = queryRendered<HTMLElement>(
    section,
    ":scope > [data-pe-item], :scope > * > [data-pe-item], [data-profile-evidence-item]",
  );
  if (explicit.length > 0) {
    const result = uniqueElements(explicit);
    activeDomReadSession?.sectionItems.set(section, result);
    return [...result];
  }

  // LinkedIn wraps its primary section list in several presentation divs. Find
  // top-level lists relative to the section instead of depending on wrapper
  // depth or generated class names. Nested lists belong to the entry itself.
  const topLevelLists = queryRendered<HTMLElement>(section, "ul, ol").filter((list) => {
    const ancestorList = list.parentElement?.closest("ul, ol");
    return !ancestorList || !section.contains(ancestorList);
  });
  const semantic = topLevelLists.flatMap((list) =>
    Array.from(list.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.matches("li") && isElementRendered(child),
    ),
  );
  if (semantic.length > 0) {
    const result = uniqueElements(semantic);
    activeDomReadSession?.sectionItems.set(section, result);
    return [...result];
  }

  const articles = queryRendered<HTMLElement>(section, "article").filter((article) => {
    const ancestorArticle = article.parentElement?.closest("article");
    return !ancestorArticle || !section.contains(ancestorArticle);
  });
  const result = uniqueElements(articles);
  activeDomReadSession?.sectionItems.set(section, result);
  return [...result];
}

export function meaningfulSectionText(section: Element): string {
  const cached = activeDomReadSession?.sectionText.get(section);
  if (cached !== undefined) return cached;
  const fragments: string[] = [];
  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      fragments.push(node.textContent ?? "");
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (
      element !== section &&
      element.matches(`${HEADING_SELECTOR}, button, nav, script, style, template, noscript`)
    ) {
      return;
    }
    if (!isElementRendered(element)) return;
    element.childNodes.forEach(visit);
  };
  visit(section);
  const text = normalizeVisibleText(fragments.join(" "));
  activeDomReadSession?.sectionText.set(section, text);
  return text;
}

/**
 * Returns page-owned rendered text nodes in DOM order without flattening their
 * surrounding section into one opaque string. LinkedIn's current profile cards
 * use presentation divs instead of list/article semantics, so these segments
 * are the stable fallback for reconstructing visible rows.
 */
export function renderedTextSegments(root: ParentNode): string[] {
  const cached = activeDomReadSession?.textSegments.get(root);
  if (cached) return [...cached];
  const segments: string[] = [];
  const visit = (node: Node): void => {
    if (node.nodeType === node.TEXT_NODE) {
      const text = normalizeVisibleText(node.textContent);
      if (text) segments.push(text);
      return;
    }
    if (node.nodeType !== node.ELEMENT_NODE) return;
    const element = node as Element;
    if (element.matches("script, style, template, noscript") || !isElementRendered(element)) return;
    element.childNodes.forEach(visit);
  };
  root.childNodes.forEach(visit);
  activeDomReadSession?.textSegments.set(root, segments);
  return [...segments];
}

export function readField(root: ParentNode, field: string, fallbacks: readonly string[] = []): ElementMatch | undefined {
  return firstRendered<HTMLElement>(root, [
    `[data-pe-field='${field}']`,
    `[data-profile-evidence-field='${field}']`,
    ...fallbacks,
  ]);
}

export function parseCompactNumber(value: string, locale: string): number | undefined {
  const normalized = comparableText(value, locale);
  const match = normalized.match(/(\d[\d.,]*)\s*(k|m|mil|mi)?\+?(?=\s|$)/u);
  if (!match) return undefined;

  const suffix = match[2];
  let numeric = match[1];
  if (!numeric) return undefined;
  if (suffix) {
    numeric = numeric.replace(",", ".");
  } else if (numeric.includes(",") && numeric.includes(".")) {
    const lastComma = numeric.lastIndexOf(",");
    const lastDot = numeric.lastIndexOf(".");
    numeric = lastComma > lastDot ? numeric.replace(/\./gu, "").replace(",", ".") : numeric.replace(/,/gu, "");
  } else if (/^\d{1,3}([.,]\d{3})+$/u.test(numeric)) {
    numeric = numeric.replace(/[.,]/gu, "");
  } else {
    numeric = numeric.replace(",", ".");
  }

  const parsed = Number.parseFloat(numeric);
  if (!Number.isFinite(parsed)) return undefined;
  const multiplier = suffix === "k" || suffix === "mil" ? 1_000 : suffix === "m" || suffix === "mi" ? 1_000_000 : 1;
  return Math.round(parsed * multiplier);
}

export function similarText(left: string, right: string, locale: string): number {
  const leftTokens = new Set(tokenize(left, locale));
  const rightTokens = new Set(tokenize(right, locale));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1;
  });
  return intersection / Math.max(leftTokens.size, rightTokens.size);
}

export function tokenize(value: string, locale: string): string[] {
  return comparableText(value, locale)
    .split(/[^\p{L}\p{N}+#.]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

export function uniqueElements<T extends Element>(elements: readonly T[]): T[] {
  return Array.from(new Set(elements));
}
