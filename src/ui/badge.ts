import type { ScoreResult } from "../scoring";
import {
  getCopy,
  type SupportedUiLocale,
  type UiCopy
} from "./copy";
import type { EvidenceCardOptions } from "./hover-card";
import {
  createEvidencePopover,
  EVIDENCE_POPOVER_HOST_ATTRIBUTE,
  EVIDENCE_POPOVER_HOST_VALUE,
  type EvidencePopoverController,
  type ScoreSurfacePresentationModel
} from "./evidence-popover";
import { BADGE_STYLES } from "./styles";

export const BADGE_HOST_ATTRIBUTE = "data-profile-authenticity-host";
export const BADGE_HOST_VALUE = "profile-evidence-badge";
export const OVERLAY_HOST_ATTRIBUTE = "data-profile-authenticity-overlay";
export const OVERLAY_HOST_VALUE = "profile-evidence-details";

export type ScoreColorBand = "red" | "orange" | "yellow" | "green";

export function scoreColorBand(score: number): ScoreColorBand {
  if (score <= 30) return "red";
  if (score <= 50) return "orange";
  if (score <= 88) return "yellow";
  return "green";
}

function potentiallyVisible(element: HTMLElement): boolean {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.hidden || current.getAttribute("aria-hidden") === "true") {
      return false;
    }
    const style = globalThis.getComputedStyle?.(current);
    if (
      style?.display === "none" ||
      style?.visibility === "hidden" ||
      style?.visibility === "collapse"
    ) {
      return false;
    }
  }
  return true;
}

function safeHeading(candidates: Element[]): HTMLElement | null {
  const headings = candidates.filter(
    (candidate): candidate is HTMLElement =>
      candidate instanceof HTMLElement &&
      potentiallyVisible(candidate) &&
      Boolean(candidate.textContent?.normalize("NFC").trim()) &&
      (candidate.textContent?.length ?? 0) <= 200 &&
      !candidate.closest(`[${BADGE_HOST_ATTRIBUTE}]`) &&
      !looksLikeSectionHeading(candidate)
  );
  return headings.length === 1 ? headings[0] ?? null : null;
}

function normalizedText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase()
    .replace(/[&/]/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizedHeadingText(element: Element): string {
  return normalizedText(element.textContent ?? "");
}

const SECTION_HEADING_PATTERN = /^(?:about|acerca de|sobre|highlights?|destaques?|destacados?|activity|atividade|actividad|experience|experiencia|education|educacao|formacao academica|skills?|competencias?|aptitudes?|recommendations?|recomendacoes?|recomendaciones?|featured|em destaque|interests?|interesses?|intereses?|licenses? certifications?|licencas certificacoes|licencias certificaciones|projects?|projetos?|proyectos?|courses?|cursos?|publications?|publicacoes?|publicaciones?|honors awards|honras premios|idiomas?|languages?|volunteer experience|trabalho voluntario|experiencia de voluntariado)$/u;

function looksLikeSectionHeading(element: Element): boolean {
  return SECTION_HEADING_PATTERN.test(normalizedHeadingText(element));
}

function normalizedPathname(value: string): string {
  try {
    const pathname = new URL(value, globalThis.location?.href).pathname;
    return pathname.replace(/\/+$/, "").toLowerCase();
  } catch {
    return "";
  }
}

function headingForCurrentProfileLink(root: ParentNode): HTMLElement | null {
  const currentPath = normalizedPathname(globalThis.location?.href ?? "");
  if (!/^\/in\/[^/]+$/i.test(currentPath)) {
    return null;
  }

  const linkedHeadings = [...root.querySelectorAll(
    "main a[href] h1, main a[href] h2, main a[href] [role='heading'], [role='main'] a[href] h1, [role='main'] a[href] h2, [role='main'] a[href] [role='heading']"
  )]
    .filter((candidate) => {
      const link = candidate.closest<HTMLAnchorElement>("a[href]");
      return link !== null && normalizedPathname(link.href) === currentPath;
    });
  return safeHeading(linkedHeadings);
}

function semanticHeadings(root: ParentNode): HTMLElement[] {
  const candidates = root.querySelectorAll<HTMLElement>(
    "main h1, main h2, main [role='heading'][aria-level='1'], main [role='heading'][aria-level='2'], [role='main'] h1, [role='main'] h2, [role='main'] [role='heading'][aria-level='1'], [role='main'] [role='heading'][aria-level='2']"
  );
  return [...new Set(candidates)].filter(
    (candidate) =>
      potentiallyVisible(candidate) &&
      Boolean(candidate.textContent?.normalize("NFC").trim()) &&
      (candidate.textContent?.length ?? 0) <= 200 &&
      !candidate.closest(`[${BADGE_HOST_ATTRIBUTE}]`) &&
      !looksLikeSectionHeading(candidate)
  );
}

function topCardScope(heading: HTMLElement): HTMLElement | null {
  return heading.closest<HTMLElement>(
    "[data-pe-top-card], [data-profile-evidence-top-card], section, [role='region'], [data-view-name='profile-card']"
  );
}

function topCardSignalCount(
  heading: HTMLElement,
  currentPath: string,
  firstHeading: HTMLElement | undefined
): { count: number; ownsCurrentProfileRoute: boolean } {
  const card = topCardScope(heading);
  if (!card) {
    return { count: 0, ownsCurrentProfileRoute: false };
  }
  if (
    card.matches(
      "[data-pe-top-card], [data-profile-evidence-top-card]"
    )
  ) {
    return { count: 4, ownsCurrentProfileRoute: true };
  }

  const cardText = normalizedHeadingText(card);
  const interactiveText = [...card.querySelectorAll<HTMLElement>(
    "a, button, [role='button']"
  )].map((element) =>
    normalizedHeadingText(element) +
    " " +
    normalizedText(
      [
        element.getAttribute("aria-label"),
        element.getAttribute("title")
      ].filter(Boolean).join(" ")
    )
  ).join(" ");

  const ownsCurrentProfileRoute = [...card.querySelectorAll<HTMLAnchorElement>(
    "a[href]"
  )].some((link) => {
    const path = normalizedPathname(link.href);
    return path === currentPath || path.startsWith(`${currentPath}/`);
  });

  const signals = [
    /\b(?:contact info|informacoes de contato|informacion de contacto)\b/u.test(
      `${cardText} ${interactiveText}`
    ),
    /\b(?:connections?|conexoes|conexiones|followers?|seguidores?)\b/u.test(
      cardText
    ),
    /\b(?:message|connect|follow|mensagem|conectar|seguir|mensaje)\b/u.test(
      interactiveText
    ),
    card.querySelector(
      "img, [data-view-name*='profile-photo'], a[href*='/overlay/profile-photo/'], a[href*='/overlay/photo/']"
    ) !== null,
    card.querySelector(
      "[data-pe-field='headline'], [data-profile-evidence-field='headline'], [data-field='headline'], a[href*='/company/']"
    ) !== null,
    heading === firstHeading
  ];

  return {
    count: signals.filter(Boolean).length,
    ownsCurrentProfileRoute
  };
}

/**
 * LinkedIn has multiple top-card implementations. Some use an unlinked H2 or
 * ARIA heading for the person's name, while generic cards such as About can
 * also carry `data-view-name="profile-card"`. Select only a heading whose
 * own semantic card has multiple top-card signals; never trust that generic
 * page-owned attribute by itself.
 */
function headingInValidatedTopCard(root: ParentNode): HTMLElement | null {
  const currentPath = normalizedPathname(globalThis.location?.href ?? "");
  if (!/^\/in\/[^/]+$/i.test(currentPath)) {
    return null;
  }

  const headings = semanticHeadings(root);
  const firstHeading = headings[0];
  const ranked = headings.map((heading, order) => {
    const signals = topCardSignalCount(heading, currentPath, firstHeading);
    return {
      heading,
      order,
      signalCount: signals.count,
      ownsCurrentProfileRoute: signals.ownsCurrentProfileRoute
    };
  }).filter(
    ({ signalCount, ownsCurrentProfileRoute }) =>
      ownsCurrentProfileRoute || signalCount >= 2
  ).sort(
    (left, right) =>
      Number(right.ownsCurrentProfileRoute) -
        Number(left.ownsCurrentProfileRoute) ||
      right.signalCount - left.signalCount ||
      left.order - right.order
  );

  const best = ranked[0];
  const second = ranked[1];
  if (
    !best ||
    (
      second &&
      second.ownsCurrentProfileRoute === best.ownsCurrentProfileRoute &&
      second.signalCount === best.signalCount
    )
  ) {
    return null;
  }
  return best.heading;
}

/** Uses semantic, ordered strategies and declines ambiguous anchors. */
export function findProfileNameAnchor(root: ParentNode = document): HTMLElement | null {
  const linkedHeading = headingForCurrentProfileLink(root);
  if (linkedHeading) {
    return linkedHeading;
  }

  const explicitHeading = safeHeading([
    ...root.querySelectorAll(
      "[data-pe-field='name'], [data-profile-evidence-field='name']"
    )
  ]);
  if (explicitHeading) {
    return explicitHeading;
  }

  const cardHeading = headingInValidatedTopCard(root);
  if (cardHeading) {
    return cardHeading;
  }

  // An isolated semantic heading is safe for older/minimal profile layouts.
  // On a fully rendered page, multiple headings require top-card validation.
  return safeHeading(semanticHeadings(root));
}

export function badgeTone(result: ScoreResult): "neutral" | "supporting" | "caution" {
  if (result.presentation.neutral || !result.presentation.showBandInterpretation) {
    return "neutral";
  }
  return result.score < 35 ? "caution" : result.score >= 65 ? "supporting" : "neutral";
}

function isFlexContainer(element: HTMLElement): boolean {
  const display = globalThis.getComputedStyle?.(element).display ?? "";
  return display === "flex" || display === "inline-flex";
}

/**
 * Places the badge in LinkedIn's name row without relying on generated class
 * names. Current pages wrap the H2 and verification icon in a profile link;
 * the first flex container outside that link is the stable visual name row.
 */
function insertBesideProfileName(anchor: HTMLElement, host: HTMLElement): void {
  const profileLink = anchor.closest<HTMLElement>("a[href]");
  if (profileLink) {
    let rowChild: HTMLElement = profileLink;
    for (let depth = 0; depth < 7; depth += 1) {
      const parent = rowChild.parentElement;
      if (!parent) {
        break;
      }
      if (isFlexContainer(parent)) {
        rowChild.insertAdjacentElement("afterend", host);
        return;
      }
      rowChild = parent;
    }
    profileLink.insertAdjacentElement("afterend", host);
    return;
  }

  if (anchor.parentElement && isFlexContainer(anchor.parentElement)) {
    anchor.insertAdjacentElement("afterend", host);
    return;
  }

  // Older LinkedIn variants expose a block-level H1 without a semantic name
  // link or flex row. Appending the isolated host as the heading's final
  // phrasing child keeps the score on the same visual line as the name.
  anchor.append(host);
}

export interface BadgeController {
  readonly host: HTMLElement;
  readonly anchor: HTMLElement;
  readonly trigger: HTMLButtonElement;
  update(result: ScoreResult, locale: SupportedUiLocale, options?: EvidenceCardOptions): void;
  showEvidence(): void;
  hideEvidence(): void;
  destroy(): void;
}

export interface BadgeMountOptions {
  popover?: EvidencePopoverController;
}

export function mountBadge(
  anchor: HTMLElement,
  result: ScoreResult,
  locale: SupportedUiLocale,
  options: BadgeMountOptions = {}
): BadgeController {
  document
    .querySelectorAll<HTMLElement>(`[${BADGE_HOST_ATTRIBUTE}="${BADGE_HOST_VALUE}"]`)
    .forEach((existing) => existing.remove());

  const doc = anchor.ownerDocument;
  if (!options.popover) {
    doc.querySelectorAll<HTMLElement>(
      `[${EVIDENCE_POPOVER_HOST_ATTRIBUTE}="${EVIDENCE_POPOVER_HOST_VALUE}"]`
    ).forEach((existing) => existing.remove());
  }
  const popover = options.popover ?? createEvidencePopover(doc);
  const ownsPopover = options.popover === undefined;

  const host = document.createElement("span");
  host.setAttribute(BADGE_HOST_ATTRIBUTE, BADGE_HOST_VALUE);
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = BADGE_STYLES;

  const wrap = document.createElement("span");
  wrap.className = "pae-wrap";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "pae-badge";
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");

  const meter = document.createElement("span");
  meter.className = "pae-meter";
  meter.setAttribute("aria-hidden", "true");
  const value = document.createElement("span");
  value.className = "pae-value";
  const scale = document.createElement("span");
  scale.className = "pae-scale";
  scale.setAttribute("aria-hidden", "true");
  scale.textContent = "/100";
  const scoreGroup = document.createElement("span");
  scoreGroup.className = "pae-score-group";
  scoreGroup.append(value, scale);
  trigger.append(meter, scoreGroup);

  wrap.append(trigger);
  shadow.append(style, wrap);

  insertBesideProfileName(anchor, host);

  let ui: UiCopy = getCopy(locale);
  let currentResult = result;
  let currentLocale = locale;
  let cardOptions: EvidenceCardOptions = {};

  const presentation = (): ScoreSurfacePresentationModel => ({
    result: currentResult,
    locale: currentLocale,
    tone: badgeTone(currentResult),
    scanState: cardOptions.mode === "full" ? "complete" : "available",
    mode: cardOptions.mode ?? "initial",
    ...(cardOptions.checkedCount === undefined
      ? {}
      : { checkedCount: cardOptions.checkedCount }),
    ...(cardOptions.totalCount === undefined
      ? {}
      : { totalCount: cardOptions.totalCount })
  });

  const showCard = (): void => {
    popover.show(trigger, presentation());
  };

  const pinCard = (): void => {
    if (popover.currentAnchor === trigger && popover.mode === "pinned") {
      popover.hide({ immediate: true, force: true });
      return;
    }
    popover.pin(trigger, presentation());
  };

  wrap.addEventListener("pointerenter", showCard);
  wrap.addEventListener("pointerleave", () => popover.hide({ immediate: false }));
  wrap.addEventListener("focusin", showCard);
  wrap.addEventListener("focusout", () => popover.hide({ immediate: false }));
  trigger.addEventListener("click", pinCard);
  trigger.addEventListener("keydown", (event) => {
    if (
      event.key !== "Tab" ||
      event.shiftKey ||
      popover.currentAnchor !== trigger
    ) {
      return;
    }
    event.preventDefault();
    popover.pin(trigger, presentation());
    queueMicrotask(() => popover.focusFirstControl());
  });

  const controller: BadgeController = {
    host,
    anchor,
    trigger,
    update(nextResult, nextLocale, nextOptions = {}) {
      ui = getCopy(nextLocale);
      currentResult = nextResult;
      currentLocale = nextLocale;
      cardOptions = nextOptions;
      value.textContent = String(nextResult.score);
      trigger.dataset.tone = badgeTone(nextResult);
      trigger.dataset.scoreBand = scoreColorBand(nextResult.score);
      trigger.setAttribute("aria-label", ui.badgeLabel(nextResult.score));
      if (popover.currentAnchor === trigger) popover.update(presentation());
    },
    showEvidence: showCard,
    hideEvidence: () => popover.hide({ immediate: true, force: true }),
    destroy() {
      if (popover.currentAnchor === trigger) {
        popover.hide({ immediate: true, force: true });
      }
      if (ownsPopover) popover.destroy();
      host.remove();
    }
  };
  controller.update(result, locale);
  return controller;
}
