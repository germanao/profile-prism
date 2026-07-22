import type { ScoreResult } from "../scoring";
import { getCopy, type SupportedUiLocale } from "./copy";
import {
  renderEvidenceCard,
  type EvidenceScanMode
} from "./hover-card";
import { EVIDENCE_POPOVER_STYLES } from "./styles";

export const EVIDENCE_POPOVER_HOST_ATTRIBUTE = "data-profile-authenticity-overlay";
export const EVIDENCE_POPOVER_HOST_VALUE = "profile-evidence-details";
export const EVIDENCE_POPOVER_CARD_ID = "pae-evidence-popover";

export type EvidencePopoverMode = "preview" | "pinned";
export type ScoreSurfaceTone = "neutral" | "supporting" | "caution";
export type ScoreSurfaceScanState =
  | "available"
  | "scanning"
  | "complete"
  | "partial"
  | "cancelled"
  | "failed";

export interface ScoreSurfacePresentationModel {
  result: ScoreResult;
  locale: SupportedUiLocale;
  tone: ScoreSurfaceTone;
  scanState: ScoreSurfaceScanState;
  mode: EvidenceScanMode;
  checkedCount?: number;
  totalCount?: number;
}

export interface EvidencePopoverHideOptions {
  immediate?: boolean;
  returnFocus?: boolean;
  force?: boolean;
}

export interface EvidencePopoverController {
  readonly host: HTMLElement;
  readonly card: HTMLElement;
  readonly mode: EvidencePopoverMode;
  readonly currentAnchor: HTMLElement | null;
  show(anchor: HTMLElement, model: ScoreSurfacePresentationModel): void;
  pin(anchor?: HTMLElement, model?: ScoreSurfacePresentationModel): void;
  hide(options?: EvidencePopoverHideOptions): void;
  update(model: ScoreSurfacePresentationModel): void;
  focusFirstControl(): boolean;
  destroy(): void;
}

function closeIcon(document: Document): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "m7 7 10 10M17 7 7 17");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-width", "2");
  svg.append(path);
  return svg;
}

export function createEvidencePopover(
  document: Document = globalThis.document
): EvidencePopoverController {
  const host = document.createElement("span");
  host.setAttribute("data-profile-authenticity-host", "profile-evidence-overlay");
  host.setAttribute(EVIDENCE_POPOVER_HOST_ATTRIBUTE, EVIDENCE_POPOVER_HOST_VALUE);
  host.setAttribute("aria-hidden", "true");

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = EVIDENCE_POPOVER_STYLES;

  const card = document.createElement("section");
  card.id = EVIDENCE_POPOVER_CARD_ID;
  card.className = "pae-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "false");
  card.hidden = true;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "pae-close";
  close.hidden = true;
  close.append(closeIcon(document));

  const cardContent = document.createElement("div");
  cardContent.className = "pae-card-content";
  card.append(close, cardContent);
  shadow.append(style, card);
  document.documentElement.append(host);

  let presentation: ScoreSurfacePresentationModel | null = null;
  let anchor: HTMLElement | null = null;
  let popoverMode: EvidencePopoverMode = "preview";
  let expanded = false;
  let visible = false;
  let hideTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let positionFrame: number | undefined;
  let pageListenersAttached = false;

  const view = document.defaultView ?? globalThis;

  const clearHideTimer = (): void => {
    if (hideTimer !== undefined) {
      globalThis.clearTimeout(hideTimer);
      hideTimer = undefined;
    }
  };

  const position = (): void => {
    if (!visible || card.hidden || !anchor) return;
    const gutter = 12;
    const gap = 10;
    const viewportWidth = Math.max(0, view.innerWidth);
    const viewportHeight = Math.max(0, view.innerHeight);
    const anchorRect = anchor.getBoundingClientRect();
    card.style.visibility = "hidden";
    card.style.insetInlineStart = "0";
    card.style.insetBlockStart = "0";
    const cardRect = card.getBoundingClientRect();
    const left = Math.max(
      gutter,
      Math.min(anchorRect.left, viewportWidth - cardRect.width - gutter)
    );
    const roomBelow = viewportHeight - anchorRect.bottom - gutter;
    const placeBelow = roomBelow >= cardRect.height + gap;
    const top = placeBelow
      ? anchorRect.bottom + gap
      : Math.max(gutter, anchorRect.top - cardRect.height - gap);
    card.style.setProperty("--pae-origin-x", `${Math.max(20, anchorRect.left - left + anchorRect.width / 2)}px`);
    card.style.setProperty("--pae-origin-y", placeBelow ? "0%" : "100%");
    card.style.insetInlineStart = `${left}px`;
    card.style.insetBlockStart = `${top}px`;
    card.style.visibility = "visible";
  };

  const schedulePosition = (): void => {
    if (positionFrame !== undefined) return;
    const requestFrame = view.requestAnimationFrame?.bind(view);
    if (!requestFrame) {
      position();
      return;
    }
    positionFrame = requestFrame(() => {
      positionFrame = undefined;
      position();
    });
  };

  const detachPageListeners = (): void => {
    if (!pageListenersAttached) return;
    pageListenersAttached = false;
    view.removeEventListener("resize", schedulePosition);
    view.removeEventListener("scroll", schedulePosition, true);
    document.removeEventListener("keydown", onEscape, true);
    document.removeEventListener("pointerdown", onOutsidePointerDown, true);
    if (positionFrame !== undefined) {
      view.cancelAnimationFrame?.(positionFrame);
      positionFrame = undefined;
    }
  };

  const attachPageListeners = (): void => {
    if (pageListenersAttached) return;
    pageListenersAttached = true;
    view.addEventListener("resize", schedulePosition);
    view.addEventListener("scroll", schedulePosition, true);
    document.addEventListener("keydown", onEscape, true);
    document.addEventListener("pointerdown", onOutsidePointerDown, true);
  };

  const render = (): void => {
    if (!presentation) return;
    const ui = getCopy(presentation.locale);
    card.dataset.mode = popoverMode;
    card.dataset.view = expanded ? "expanded" : "preview";
    host.dataset.tone = presentation.tone;
    host.dataset.scanState = presentation.scanState;
    close.hidden = popoverMode !== "pinned";
    close.setAttribute("aria-label", ui.close);
    card.setAttribute("aria-label", ui.scoreHeading(presentation.result.score));
    renderEvidenceCard(
      cardContent,
      presentation.result,
      ui,
      presentation.locale,
      {
        mode: presentation.mode,
        ...(presentation.checkedCount === undefined
          ? {}
          : { checkedCount: presentation.checkedCount }),
        ...(presentation.totalCount === undefined
          ? {}
          : { totalCount: presentation.totalCount }),
        view: expanded ? "expanded" : "preview",
        pinned: popoverMode === "pinned",
        onToggleExpanded: () => {
          expanded = !expanded;
          render();
          queueMicrotask(() => {
            shadow.querySelector<HTMLButtonElement>(".pae-disclosure")?.focus();
          });
        }
      }
    );
    schedulePosition();
  };

  const setAnchor = (nextAnchor: HTMLElement): void => {
    if (anchor && anchor !== nextAnchor) {
      anchor.setAttribute("aria-expanded", "false");
    }
    anchor = nextAnchor;
    anchor.setAttribute("aria-expanded", "true");
    anchor.setAttribute("aria-controls", EVIDENCE_POPOVER_CARD_ID);
  };

  const reveal = (): void => {
    visible = true;
    card.hidden = false;
    host.setAttribute("aria-hidden", "false");
    attachPageListeners();
    render();
  };

  const hideNow = (returnFocus: boolean): void => {
    clearHideTimer();
    const returnTarget = anchor;
    anchor?.setAttribute("aria-expanded", "false");
    visible = false;
    expanded = false;
    popoverMode = "preview";
    card.hidden = true;
    host.setAttribute("aria-hidden", "true");
    detachPageListeners();
    presentation = null;
    anchor = null;
    if (returnFocus && returnTarget?.isConnected) returnTarget.focus();
  };

  const controller: EvidencePopoverController = {
    host,
    card,
    get mode() { return popoverMode; },
    get currentAnchor() { return anchor; },
    show(nextAnchor, model) {
      clearHideTimer();
      if (popoverMode === "pinned" && anchor !== nextAnchor) return;
      if (popoverMode !== "pinned") {
        popoverMode = "preview";
        expanded = false;
      }
      presentation = model;
      setAnchor(nextAnchor);
      reveal();
    },
    pin(nextAnchor, model) {
      clearHideTimer();
      if (nextAnchor) setAnchor(nextAnchor);
      if (model) presentation = model;
      if (!anchor || !presentation) return;
      popoverMode = "pinned";
      expanded = false;
      reveal();
    },
    hide(options = {}) {
      const immediate = options.immediate ?? true;
      if (popoverMode === "pinned" && !options.force) return;
      clearHideTimer();
      if (immediate) {
        hideNow(options.returnFocus === true);
      } else {
        hideTimer = globalThis.setTimeout(
          () => hideNow(options.returnFocus === true),
          180
        );
      }
    },
    update(model) {
      if (!visible || !presentation) return;
      presentation = model;
      render();
    },
    focusFirstControl() {
      const first = shadow.querySelector<HTMLButtonElement>(
        ".pae-disclosure:not([hidden])"
      ) ?? shadow.querySelector<HTMLButtonElement>(".pae-close:not([hidden])");
      first?.focus();
      return first !== null;
    },
    destroy() {
      clearHideTimer();
      detachPageListeners();
      anchor?.setAttribute("aria-expanded", "false");
      host.remove();
    }
  };

  const onEscape = (event: KeyboardEvent): void => {
    if (!visible || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    controller.hide({ immediate: true, returnFocus: true, force: true });
  };

  const onOutsidePointerDown = (event: PointerEvent): void => {
    if (!visible || popoverMode !== "pinned") return;
    const path = event.composedPath();
    if (path.includes(host) || (anchor !== null && path.includes(anchor))) return;
    controller.hide({ immediate: true, force: true });
  };

  close.addEventListener("click", () => {
    controller.hide({ immediate: true, returnFocus: true, force: true });
  });
  card.addEventListener("pointerenter", clearHideTimer);
  card.addEventListener("pointerleave", () => controller.hide({ immediate: false }));
  card.addEventListener("focusin", clearHideTimer);
  card.addEventListener("focusout", () => controller.hide({ immediate: false }));

  return controller;
}
