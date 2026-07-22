import type { ScoreResult } from "../scoring";
import { badgeTone } from "./badge";
import { getCopy, type SupportedUiLocale, type UiCopy } from "./copy";
import {
  createEvidencePopover,
  EVIDENCE_POPOVER_HOST_ATTRIBUTE,
  EVIDENCE_POPOVER_HOST_VALUE,
  type EvidencePopoverController,
  type ScoreSurfacePresentationModel
} from "./evidence-popover";
import { FAB_STYLES } from "./styles";

export const FAB_HOST_ATTRIBUTE = "data-profile-authenticity-fab";
export const FAB_HOST_VALUE = "visible-profile-scan";

export type ScanFabState =
  | "available"
  | "scanning"
  | "complete"
  | "partial"
  | "cancelled"
  | "failed";

export interface ScanFabModel {
  state: ScanFabState;
  locale: SupportedUiLocale;
  result?: ScoreResult;
  checkedCount?: number;
  totalCount?: number;
}

export interface ScanFabActions {
  start?(): void;
  cancel?(): void;
  retry?(): void;
  evidenceVisibilityChanged?(visible: boolean): void;
}

export interface ScanFabOptions {
  /** Set to 0 to keep the full completion capsule visible. Defaults to 4 seconds. */
  compactCompletionAfterMs?: number;
  popover?: EvidencePopoverController;
}

export interface ScanFabController {
  readonly host: HTMLElement;
  readonly trigger: HTMLButtonElement;
  update(model: ScanFabModel): void;
  showEvidence(): void;
  hideEvidence(): void;
  compactNow(): void;
  destroy(): void;
}

function icon(
  document: Document,
  kind: "chevron" | "check" | "close"
): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("pae-fab-icon", `pae-icon-${kind}`);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-width", "2");
  const paths: Record<typeof kind, string> = {
    chevron: "m6 9 6 6 6-6",
    check: "m5 12 4 4L19 6",
    close: "m7 7 10 10M17 7 7 17"
  };
  path.setAttribute("d", paths[kind]);
  svg.append(path);
  return svg;
}

function statePresentation(
  model: ScanFabModel,
  ui: UiCopy
): {
  label: string;
  announcement: string;
  icon: "check" | null;
} {
  const score = model.result ? ui.currentScore(model.result.score) : "";
  switch (model.state) {
    case "scanning":
      return {
        label: ui.scanScanningShort,
        announcement: [ui.scanScanning, score].filter(Boolean).join(". "),
        icon: null
      };
    case "complete":
      return {
        label: ui.scanUpdatedShort,
        announcement: [ui.scanComplete, score].filter(Boolean).join(". "),
        icon: "check"
      };
    case "partial":
      return {
        label: ui.scanRetryShort,
        announcement: [ui.scanPartial, score, ui.retryScan].filter(Boolean).join(". "),
        icon: null
      };
    case "cancelled":
      return {
        label: ui.scanRetryShort,
        announcement: [ui.scanCancelled, score, ui.retryScan].filter(Boolean).join(". "),
        icon: null
      };
    case "failed":
      return {
        label: ui.scanRetryShort,
        announcement: [ui.scanFailed, score, ui.retryScan].filter(Boolean).join(". "),
        icon: null
      };
    default:
      return {
        label: ui.scanActionShort,
        announcement: [ui.scanAvailable, score, ui.scanAction].filter(Boolean).join(". "),
        icon: null
      };
  }
}

export function mountScanFab(
  initialModel: ScanFabModel,
  actions: ScanFabActions = {},
  options: ScanFabOptions = {}
): ScanFabController {
  const document = globalThis.document;
  document.querySelectorAll<HTMLElement>(`[${FAB_HOST_ATTRIBUTE}="${FAB_HOST_VALUE}"]`)
    .forEach((existing) => existing.remove());
  if (!options.popover) {
    document.querySelectorAll<HTMLElement>(
      `[${EVIDENCE_POPOVER_HOST_ATTRIBUTE}="${EVIDENCE_POPOVER_HOST_VALUE}"]`
    ).forEach((existing) => existing.remove());
  }

  const popover = options.popover ?? createEvidencePopover(document);
  const ownsPopover = options.popover === undefined;

  const host = document.createElement("aside");
  host.setAttribute(FAB_HOST_ATTRIBUTE, FAB_HOST_VALUE);
  host.setAttribute("data-profile-authenticity-host", "visible-profile-scan-fab");
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = FAB_STYLES;

  const wrap = document.createElement("div");
  wrap.className = "pae-fab-wrap";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "pae-fab";
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");

  const score = document.createElement("span");
  score.className = "pae-fab-score";
  const divider = document.createElement("span");
  divider.className = "pae-fab-divider";
  divider.setAttribute("aria-hidden", "true");
  divider.textContent = " - ";
  const iconSlot = document.createElement("span");
  iconSlot.className = "pae-fab-icon-slot";
  const label = document.createElement("span");
  label.className = "pae-fab-label";
  const chevron = icon(document, "chevron");
  chevron.classList.add("pae-fab-chevron");
  trigger.append(score, divider, label, iconSlot, chevron);

  const auxiliary = document.createElement("button");
  auxiliary.type = "button";
  auxiliary.className = "pae-fab-aux";
  auxiliary.hidden = true;
  auxiliary.append(icon(document, "close"));

  const live = document.createElement("span");
  live.className = "pae-sr-only";
  live.setAttribute("aria-live", "polite");
  live.setAttribute("aria-atomic", "true");
  wrap.append(trigger, auxiliary, live);
  shadow.append(style, wrap);
  document.documentElement.append(host);

  let model = initialModel;
  let ui = getCopy(model.locale);
  let compactTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

  const popoverPresentation = (): ScoreSurfacePresentationModel | null => {
    if (!model.result) return null;
    return {
      result: model.result,
      locale: model.locale,
      tone: badgeTone(model.result),
      scanState: model.state,
      mode: model.state === "complete" ? "full" : "initial",
      ...(model.checkedCount === undefined ? {} : { checkedCount: model.checkedCount }),
      ...(model.totalCount === undefined ? {} : { totalCount: model.totalCount })
    };
  };

  const showEvidence = (): void => {
    const presentation = popoverPresentation();
    if (!presentation) return;
    popover.show(trigger, presentation);
    actions.evidenceVisibilityChanged?.(true);
  };

  const pinEvidence = (): void => {
    const presentation = popoverPresentation();
    if (!presentation) return;
    if (popover.currentAnchor === trigger && popover.mode === "pinned") {
      popover.hide({ immediate: true, force: true });
      actions.evidenceVisibilityChanged?.(false);
      return;
    }
    popover.pin(trigger, presentation);
    actions.evidenceVisibilityChanged?.(true);
  };

  trigger.addEventListener("pointerenter", showEvidence);
  wrap.addEventListener("pointerleave", () => popover.hide({ immediate: false }));
  trigger.addEventListener("focus", showEvidence);
  trigger.addEventListener("blur", () => popover.hide({ immediate: false }));
  trigger.addEventListener("keydown", (event) => {
    if (
      event.key !== "Tab" ||
      event.shiftKey ||
      popover.currentAnchor !== trigger
    ) return;
    const presentation = popoverPresentation();
    if (!presentation) return;
    event.preventDefault();
    popover.pin(trigger, presentation);
    queueMicrotask(() => popover.focusFirstControl());
  });

  const compactNow = (): void => host.setAttribute("data-compact", "true");

  const controller: ScanFabController = {
    host,
    trigger,
    update(nextModel) {
      model = nextModel;
      ui = getCopy(model.locale);
      host.dataset.state = model.state;
      host.removeAttribute("data-compact");
      if (compactTimer !== undefined) globalThis.clearTimeout(compactTimer);

      const content = statePresentation(model, ui);
      score.textContent = model.result ? String(model.result.score) : "";
      score.hidden = model.result === undefined;
      divider.hidden = model.result === undefined;
      label.textContent = content.label;
      iconSlot.replaceChildren();
      if (model.state === "scanning") {
        const spinner = document.createElement("span");
        spinner.classList.add("pae-spinner");
        iconSlot.append(spinner);
      } else if (content.icon) {
        iconSlot.append(icon(document, content.icon));
      }
      chevron.toggleAttribute("hidden", model.state !== "available");
      live.textContent = content.announcement;

      trigger.onclick = null;
      if (model.state === "available") {
        trigger.onclick = () => actions.start?.();
        trigger.setAttribute(
          "aria-label",
          [
            ui.scanAction,
            model.result ? ui.currentScore(model.result.score) : ""
          ].filter(Boolean).join(". ")
        );
      } else if (model.state === "scanning") {
        trigger.onclick = () => actions.cancel?.();
        trigger.setAttribute(
          "aria-label",
          `${ui.cancelScan}. ${model.result ? ui.currentScore(model.result.score) : ""}`.trim()
        );
      } else if (
        model.state === "cancelled" ||
        model.state === "failed" ||
        model.state === "partial"
      ) {
        trigger.onclick = () => actions.retry?.();
        trigger.setAttribute("aria-label", content.announcement);
      } else {
        trigger.onclick = pinEvidence;
        trigger.setAttribute("aria-label", content.announcement);
      }

      auxiliary.hidden = model.state !== "scanning";
      auxiliary.setAttribute("aria-label", ui.cancelScan);
      auxiliary.onclick = model.state === "scanning" ? () => actions.cancel?.() : null;

      const presentation = popoverPresentation();
      if (popover.currentAnchor === trigger && presentation) {
        popover.update(presentation);
      } else if (!presentation && popover.currentAnchor === trigger) {
        popover.hide({ immediate: true, force: true });
      }

      const delay = options.compactCompletionAfterMs ?? 4000;
      if (model.state === "complete" && delay > 0) {
        compactTimer = globalThis.setTimeout(compactNow, delay);
      }
    },
    showEvidence,
    hideEvidence() {
      if (popover.currentAnchor === trigger) {
        popover.hide({ immediate: true, force: true });
        actions.evidenceVisibilityChanged?.(false);
      }
    },
    compactNow,
    destroy() {
      if (compactTimer !== undefined) globalThis.clearTimeout(compactTimer);
      if (popover.currentAnchor === trigger) {
        popover.hide({ immediate: true, force: true });
      }
      if (ownsPopover) popover.destroy();
      host.remove();
    }
  };

  controller.update(initialModel);
  return controller;
}
