import {
  elementText,
  isElementRendered,
  queryRendered,
  readField,
} from "./dom";
import type { ElementMatch } from "./types";

const TOP_CARD_SELECTOR = [
  "[data-pe-top-card]",
  "[data-profile-evidence-top-card]",
  "[data-view-name='profile-card']",
  "section",
  "[role='region']",
].join(", ");

const HEADING_SELECTOR = "h1, h2, h3, [role='heading']";
const INTERACTIVE_SELECTOR = "button, [role='button']";

function rootElement(root: ParentNode): Element | undefined {
  return (root as Node).nodeType === 1 ? root as Element : undefined;
}

/** Returns the smallest semantic top-card scope that owns the profile name. */
export function findTopCardScope(
  root: ParentNode,
  nameAnchor?: HTMLElement,
): HTMLElement | undefined {
  const ownRoot = rootElement(root);
  if (
    ownRoot instanceof HTMLElement &&
    ownRoot.matches(TOP_CARD_SELECTOR) &&
    (!nameAnchor || ownRoot.contains(nameAnchor)) &&
    isElementRendered(ownRoot)
  ) {
    return ownRoot;
  }

  const explicitCards = queryRendered<HTMLElement>(
    root,
    "[data-pe-top-card], [data-profile-evidence-top-card], [data-view-name='profile-card']",
  );
  const explicit = explicitCards.find((card) => !nameAnchor || card.contains(nameAnchor));
  if (explicit) return explicit;

  return nameAnchor?.closest<HTMLElement>(TOP_CARD_SELECTOR) ??
    nameAnchor?.parentElement ??
    undefined;
}

function isAfter(anchor: Element, candidate: Element): boolean {
  return Boolean(anchor.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function isBefore(candidate: Element, boundary: Element): boolean {
  return Boolean(candidate.compareDocumentPosition(boundary) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function firstHeadingAfter(scope: ParentNode, nameAnchor: HTMLElement): HTMLElement | undefined {
  return queryRendered<HTMLElement>(scope, HEADING_SELECTOR).find((heading) =>
    heading !== nameAnchor &&
    !nameAnchor.contains(heading) &&
    !heading.closest(INTERACTIVE_SELECTOR) &&
    isAfter(nameAnchor, heading),
  );
}

function descriptor(element: HTMLElement): string {
  return [
    elementText(element),
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

function isProfileAction(element: HTMLElement): boolean {
  if (element.closest("[data-profile-authenticity-host]")) return true;
  const value = descriptor(element);
  if (/\bverifica(?:tion|tions|cao|coes|cion|ciones)\b/u.test(value)) return true;
  return /^(?:open to|add section|enhance profile|more|connect|message|follow|edit|contact(?: info)?|view profile photo|edit profile|edit background image|aberto a|adicionar secao|melhorar perfil|mais|conectar|mensagem|seguir|editar|informacoes de contato|ver foto do perfil|anadir seccion|mejorar perfil|mas|mensaje|informacion de contacto|ver foto de perfil)(?:\b|\s)/u.test(value);
}

function readableLabel(element: HTMLElement): boolean {
  const text = elementText(element);
  return text.length >= 2 && text.length <= 100;
}

function isAffiliationShape(element: HTMLElement): boolean {
  if (!element.querySelector("figure")) return false;
  return queryRendered<HTMLElement>(element, "p").some(readableLabel);
}

function affiliationCandidates(
  scope: ParentNode,
  nameAnchor?: HTMLElement,
): HTMLElement[] {
  const boundary = nameAnchor ? firstHeadingAfter(scope, nameAnchor) : undefined;
  return queryRendered<HTMLElement>(scope, INTERACTIVE_SELECTOR).filter((candidate) => {
    if (nameAnchor && !isAfter(nameAnchor, candidate)) return false;
    if (boundary && !isBefore(candidate, boundary)) return false;
    return readableLabel(candidate) && !isProfileAction(candidate);
  });
}

/**
 * Locates the visible current-company label in a top card.
 *
 * LinkedIn's current semantic layout exposes company and education as two
 * figure-and-paragraph buttons after the profile name. Their order is stable:
 * company first, education second. Cover/photo controls precede the name and
 * profile actions do not use that affiliation shape. The simple-button
 * fallback is retained only when at least two non-action candidates form the
 * same company/education pair, which avoids guessing from a lone custom CTA.
 */
export function findCurrentCompanyMatch(
  topCard: ParentNode | undefined,
  nameAnchor?: HTMLElement,
): ElementMatch | undefined {
  if (!topCard) return undefined;
  const structured = readField(topCard, "current-company", [
    "[aria-label^='Current company:' i]",
    "[data-field='current-company']",
    "a[href*='/company/']",
  ]);
  if (structured) return structured;

  const candidates = affiliationCandidates(topCard, nameAnchor);
  const shaped = candidates.filter(isAffiliationShape);
  if (shaped[0]) {
    return {
      element: shaped[0],
      confidence: 0.84,
      source: "dom:top-card:current-company:first-structured-affiliation-after-name",
    };
  }

  if (candidates.length >= 2 && candidates[0]) {
    return {
      element: candidates[0],
      confidence: 0.58,
      source: "dom:top-card:current-company:first-affiliation-button-pair-after-name",
    };
  }
  return undefined;
}
