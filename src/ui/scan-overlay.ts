import type {
  ScanOverlayStage,
  ScanPhase,
  ScanStopReason
} from "../content/scan-types";
import { getCopy, type SupportedUiLocale, type UiCopy } from "./copy";
import { SCAN_OVERLAY_STYLES } from "./styles";

export const SCAN_OVERLAY_HOST_ATTRIBUTE =
  "data-profile-authenticity-scan-overlay";
export const SCAN_OVERLAY_HOST_VALUE = "full-profile-progress";

export interface ScanOverlayModel {
  phase: Exclude<ScanPhase, "available">;
  stage: ScanOverlayStage;
  locale: SupportedUiLocale;
  score?: number;
  checkedCount: number;
  totalCount: number;
  elapsedMs: number;
  reason?: ScanStopReason;
}

export interface ScanOverlayActions {
  cancel(): void;
  retry(): void;
  close?(): void;
}

export interface ScanOverlayController {
  readonly host: HTMLElement;
  show(origin: HTMLElement, model: ScanOverlayModel): void;
  update(model: ScanOverlayModel): void;
  hide(options?: { immediate?: boolean; restoreFocus?: boolean }): void;
  destroy(): void;
}

const SCROLL_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "PageDown",
  "PageUp",
  "Home",
  "End",
  " ",
  "Spacebar"
]);

function checkIcon(document: Document): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "m5 12 4 4L19 6");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-width", "2.25");
  svg.append(path);
  return svg;
}

function warningIcon(document: Document): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M12 8.5v4.5m0 3h.01M10.3 3.8 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.8a2 2 0 0 0-3.4 0Z"
  );
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-width", "2");
  svg.append(path);
  return svg;
}

function stageText(ui: UiCopy, stage: ScanOverlayStage): string {
  switch (stage) {
    case "verification":
      return ui.scanStageVerification;
    case "reading":
      return ui.scanStageReading;
    case "settling":
      return ui.scanStageSettling;
    case "returning":
      return ui.scanStageReturning;
    default:
      return ui.scanStagePreparing;
  }
}

function isIncomplete(phase: ScanPhase): boolean {
  return phase === "partial" || phase === "failed";
}

export function createScanOverlay(
  document: Document,
  actions: ScanOverlayActions
): ScanOverlayController {
  document.querySelectorAll<HTMLElement>(
    `[${SCAN_OVERLAY_HOST_ATTRIBUTE}="${SCAN_OVERLAY_HOST_VALUE}"]`
  ).forEach((existing) => existing.remove());

  const host = document.createElement("aside");
  host.setAttribute(SCAN_OVERLAY_HOST_ATTRIBUTE, SCAN_OVERLAY_HOST_VALUE);
  host.hidden = true;
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = SCAN_OVERLAY_STYLES;

  const overlay = document.createElement("div");
  overlay.className = "pae-scan-overlay";

  const card = document.createElement("section");
  card.className = "pae-scan-card";
  card.tabIndex = -1;
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "pae-scan-title");
  card.setAttribute(
    "aria-describedby",
    "pae-scan-question pae-scan-message"
  );

  const heading = document.createElement("header");
  heading.className = "pae-scan-heading";
  const kicker = document.createElement("p");
  kicker.className = "pae-scan-kicker";
  const title = document.createElement("h2");
  title.id = "pae-scan-title";
  title.className = "pae-scan-title";
  const question = document.createElement("p");
  question.id = "pae-scan-question";
  question.className = "pae-scan-question";
  heading.append(kicker, title, question);

  const activity = document.createElement("div");
  activity.className = "pae-scan-activity";
  const spinner = document.createElement("span");
  spinner.className = "pae-scan-spinner";
  spinner.setAttribute("aria-hidden", "true");
  const resultIcon = document.createElement("span");
  resultIcon.className = "pae-scan-result-icon";
  resultIcon.setAttribute("aria-hidden", "true");
  resultIcon.append(checkIcon(document));
  const incompleteIcon = document.createElement("span");
  incompleteIcon.className = "pae-scan-result-icon";
  incompleteIcon.dataset.tone = "warning";
  incompleteIcon.setAttribute("aria-hidden", "true");
  incompleteIcon.append(warningIcon(document));
  const activityCopy = document.createElement("div");
  const stage = document.createElement("p");
  stage.className = "pae-scan-stage";
  const elapsed = document.createElement("p");
  elapsed.className = "pae-scan-elapsed";
  activityCopy.append(stage, elapsed);
  activity.append(spinner, resultIcon, incompleteIcon, activityCopy);

  const scorePanel = document.createElement("div");
  scorePanel.className = "pae-scan-score-panel";
  const scoreCopy = document.createElement("div");
  scoreCopy.className = "pae-scan-score-copy";
  const scoreLabel = document.createElement("span");
  scoreLabel.className = "pae-scan-score-label";
  const score = document.createElement("span");
  score.className = "pae-scan-score";
  const scoreValue = document.createElement("span");
  const scale = document.createElement("span");
  scale.className = "pae-scan-scale";
  scale.textContent = "/100";
  score.append(scoreValue, scale);
  scoreCopy.append(scoreLabel, score);
  const checks = document.createElement("p");
  checks.className = "pae-scan-checks";
  scorePanel.append(scoreCopy, checks);

  const progress = document.createElement("progress");
  progress.className = "pae-scan-progress";

  const message = document.createElement("p");
  message.id = "pae-scan-message";
  message.className = "pae-scan-message";

  const actionRow = document.createElement("div");
  actionRow.className = "pae-scan-actions";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "pae-scan-button";
  const retryButton = document.createElement("button");
  retryButton.type = "button";
  retryButton.className = "pae-scan-button pae-scan-button-primary";
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "pae-scan-button";
  actionRow.append(closeButton, retryButton, cancelButton);

  const live = document.createElement("span");
  live.className = "pae-sr-only";
  live.setAttribute("aria-live", "polite");
  live.setAttribute("aria-atomic", "true");

  card.append(heading, activity, scorePanel, progress, message, actionRow, live);
  overlay.append(card);
  shadow.append(style, overlay);
  document.documentElement.append(host);

  let currentModel: ScanOverlayModel | null = null;
  let origin: HTMLElement | null = null;
  let elapsedStartedAt = Date.now();
  let elapsedTimer: ReturnType<typeof globalThis.setInterval> | undefined;
  let completionTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let closeTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let lastAnnouncement = "";

  const stopTimers = (): void => {
    if (elapsedTimer !== undefined) globalThis.clearInterval(elapsedTimer);
    if (completionTimer !== undefined) globalThis.clearTimeout(completionTimer);
    if (closeTimer !== undefined) globalThis.clearTimeout(closeTimer);
    elapsedTimer = undefined;
    completionTimer = undefined;
    closeTimer = undefined;
  };

  const visibleButtons = (): HTMLButtonElement[] =>
    [closeButton, retryButton, cancelButton].filter((button) => !button.hidden);

  const renderElapsed = (): void => {
    if (!currentModel || currentModel.phase !== "scanning") return;
    const ui = getCopy(currentModel.locale);
    const seconds = Math.max(
      0,
      Math.floor((Date.now() - elapsedStartedAt) / 1_000)
    );
    elapsed.textContent = ui.scanOverlayElapsed(seconds);
  };

  const render = (): void => {
    if (!currentModel) return;
    const ui = getCopy(currentModel.locale);
    const incomplete = isIncomplete(currentModel.phase);
    const complete = currentModel.phase === "complete";
    const scanning = currentModel.phase === "scanning";
    const currentStage = complete
      ? ui.scanComplete
      : incomplete
        ? ui.scanOverlayIncompleteTitle
        : stageText(ui, currentModel.stage);

    host.dataset.phase = currentModel.phase;
    card.setAttribute("aria-busy", String(scanning));
    kicker.textContent = ui.shortExtensionName;
    title.textContent = complete
      ? ui.scanOverlayCompleteTitle
      : incomplete
        ? ui.scanOverlayIncompleteTitle
        : ui.scanOverlayTitle;
    question.textContent = ui.authenticityQuestion;
    question.hidden = !scanning;
    stage.textContent = currentStage;
    spinner.hidden = !scanning;
    resultIcon.hidden = !complete;
    incompleteIcon.hidden = !incomplete;
    elapsed.hidden = !scanning;
    scoreLabel.textContent = scanning
      ? ui.scanOverlayLiveEstimate
      : complete
        ? ui.scanUpdatedShort
        : ui.scanOverlayLiveEstimate;
    scoreValue.textContent = currentModel.score === undefined
      ? "—"
      : String(currentModel.score);
    checks.textContent = ui.checkedEvidence(
      currentModel.checkedCount,
      currentModel.totalCount
    );
    progress.setAttribute("aria-label", checks.textContent);
    progress.max = Math.max(1, currentModel.totalCount);
    progress.value = Math.min(
      progress.max,
      Math.max(0, currentModel.checkedCount)
    );
    message.hidden = !incomplete;
    message.textContent = incomplete ? ui.scanOverlayIncompleteBody : "";
    closeButton.hidden = !incomplete;
    retryButton.hidden = !incomplete;
    cancelButton.hidden = !scanning;
    closeButton.textContent = ui.close;
    retryButton.textContent = ui.retryScan;
    cancelButton.textContent = ui.cancelScan;
    renderElapsed();

    if (currentStage !== lastAnnouncement) {
      lastAnnouncement = currentStage;
      live.textContent = currentStage;
    }
  };

  const hide = (
    options: { immediate?: boolean; restoreFocus?: boolean } = {}
  ): void => {
    if (host.hidden) return;
    stopTimers();
    const restoreFocus = options.restoreFocus !== false;
    const finish = (): void => {
      host.hidden = true;
      host.removeAttribute("data-closing");
      currentModel = null;
      if (restoreFocus && origin?.isConnected) origin.focus();
    };
    const view = document.defaultView;
    const reducedMotion = typeof view?.matchMedia === "function" &&
      view.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (options.immediate || reducedMotion) {
      finish();
      return;
    }
    host.dataset.closing = "true";
    closeTimer = globalThis.setTimeout(finish, 200);
  };

  const update = (model: ScanOverlayModel): void => {
    if (model.phase === "cancelled" || isIncomplete(model.phase)) {
      hide({ immediate: true });
      return;
    }
    const previousPhase = currentModel?.phase;
    currentModel = model;
    elapsedStartedAt = Math.min(
      elapsedStartedAt,
      Date.now() - Math.max(0, model.elapsedMs)
    );
    render();

    if (model.phase === "scanning" && elapsedTimer === undefined) {
      elapsedTimer = globalThis.setInterval(renderElapsed, 1_000);
    } else if (model.phase !== "scanning" && elapsedTimer !== undefined) {
      globalThis.clearInterval(elapsedTimer);
      elapsedTimer = undefined;
    }

    if (model.phase === "complete" && previousPhase !== "complete") {
      live.textContent = `${getCopy(model.locale).scanOverlayCompleteTitle}. ${
        model.score === undefined ? "" : getCopy(model.locale).currentScore(model.score)
      }`.trim();
      completionTimer = globalThis.setTimeout(() => hide(), 1_200);
    }
  };

  cancelButton.addEventListener("click", () => actions.cancel());
  retryButton.addEventListener("click", () => actions.retry());
  closeButton.addEventListener("click", () => {
    hide();
    actions.close?.();
  });
  overlay.addEventListener("wheel", (event) => event.preventDefault(), {
    passive: false
  });
  overlay.addEventListener("touchmove", (event) => event.preventDefault(), {
    passive: false
  });
  card.addEventListener("click", (event) => event.stopPropagation());
  overlay.addEventListener("click", (event) => event.stopPropagation());
  shadow.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (currentModel?.phase === "scanning") actions.cancel();
      else hide();
      return;
    }
    if (SCROLL_KEYS.has(event.key)) {
      event.preventDefault();
    }
    if (event.key !== "Tab") return;
    const buttons = visibleButtons();
    if (buttons.length === 0) {
      event.preventDefault();
      card.focus();
      return;
    }
    const first = buttons[0]!;
    const last = buttons[buttons.length - 1]!;
    const active = shadow.activeElement;
    if (event.shiftKey && (active === first || active === card)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  });

  return {
    host,
    show(nextOrigin, model) {
      stopTimers();
      origin = nextOrigin;
      currentModel = null;
      elapsedStartedAt = Date.now() - Math.max(0, model.elapsedMs);
      lastAnnouncement = "";
      host.hidden = false;
      host.removeAttribute("data-closing");
      update(model);
      queueMicrotask(() => {
        const firstButton = visibleButtons()[0];
        (firstButton ?? card).focus();
      });
    },
    update,
    hide,
    destroy() {
      stopTimers();
      host.remove();
      currentModel = null;
      origin = null;
    }
  };
}
