import { CRITERIA_V2, type CriterionId, type ScoreResult } from "../scoring";
import {
  criterionLabel,
  evidenceMessage,
  type SupportedUiLocale,
  type UiCopy
} from "./copy";

export type EvidenceScanMode = "initial" | "full";
export type EvidenceCardView = "preview" | "expanded";

export interface EvidenceCardOptions {
  mode?: EvidenceScanMode;
  checkedCount?: number;
  totalCount?: number;
  view?: EvidenceCardView;
  pinned?: boolean;
  onToggleExpanded?(): void;
}

interface SignalItem {
  criterion: CriterionId;
  shortText: string;
  detailedText: string;
  impact: number;
  tone: "supporting" | "caution" | "informational";
}

interface EvidenceItems {
  supporting: SignalItem[];
  caution: SignalItem[];
  informational: SignalItem[];
  unavailableCount: number;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function signalItems(
  result: ScoreResult,
  locale: SupportedUiLocale
): EvidenceItems {
  const map = (
    items: ScoreResult["explanations"]["supporting"],
    tone: SignalItem["tone"]
  ): SignalItem[] => items.map((item) => ({
    criterion: item.criterion,
    shortText: criterionLabel(item.criterion, locale),
    detailedText: evidenceMessage(
      item.messageKey,
      item.criterion,
      item.scoreImpact,
      locale
    ),
    impact: item.scoreImpact,
    tone
  }));

  return {
    supporting: map(result.explanations.supporting, "supporting"),
    caution: map(result.explanations.caution, "caution"),
    informational: map(result.explanations.informational, "informational"),
    unavailableCount: result.explanations.unavailable.length
  };
}

function impactText(value: number): string {
  const magnitude = Math.abs(value);
  const formatted = Number.isInteger(magnitude)
    ? String(magnitude)
    : magnitude.toFixed(1).replace(/\.0$/, "");
  return `${value >= 0 ? "+" : "\u2212"}${formatted}`;
}

function normalizedProgress(
  result: ScoreResult,
  options: EvidenceCardOptions
): { checked: number; total: number; mode: EvidenceScanMode } {
  const total = Math.max(1, Math.round(options.totalCount ?? CRITERIA_V2.length));
  const inferredChecked = total - result.explanations.unavailable.length;
  const checked = Math.max(0, Math.min(total, Math.round(options.checkedCount ?? inferredChecked)));
  return {
    checked,
    total,
    mode: options.mode ?? (result.coverageLevel === "high" ? "full" : "initial")
  };
}

function renderSummary(
  container: HTMLElement,
  result: ScoreResult,
  ui: UiCopy,
  options: EvidenceCardOptions
): void {
  const progress = normalizedProgress(result, options);
  container.append(
    element(
      "p",
      "pae-authenticity-question",
      ui.authenticityQuestion
    )
  );
  const status = element(
    "p",
    "pae-scan-mode",
    progress.mode === "full" ? ui.fullVisibleProfileScanned : ui.initialEstimate
  );
  container.append(status);

  const summary = element("div", "pae-score-summary");
  const score = element("p", "pae-score");
  score.setAttribute("aria-label", ui.badgeLabel(result.score));
  score.append(
    element("strong", undefined, String(result.score)),
    element("span", undefined, "/100")
  );
  const checked = element(
    "span",
    "pae-checked",
    ui.checkedEvidence(progress.checked, progress.total)
  );
  summary.append(score, checked);
  container.append(summary);

  if (result.presentation.insufficientEvidence) {
    container.append(element("p", "pae-insufficient", ui.insufficientEvidence));
  }
}

function highlightItems(items: EvidenceItems): SignalItem[] {
  const supporting = [...items.supporting].sort((a, b) => b.impact - a.impact);
  const caution = [...items.caution].sort(
    (a, b) => Math.abs(b.impact) - Math.abs(a.impact)
  );
  if (caution.length === 0) return supporting.slice(0, 3);
  return [...supporting.slice(0, 2), caution[0]!].slice(0, 3);
}

function renderSignalList(
  items: readonly SignalItem[],
  ui: UiCopy,
  detailed: boolean
): HTMLUListElement {
  const list = element("ul", detailed ? "pae-list pae-list-detailed" : "pae-list pae-list-highlights");
  for (const item of items) {
    const listItem = element("li", `pae-signal pae-${item.tone}`);
    const marker = element("span", "pae-signal-marker");
    marker.setAttribute("aria-hidden", "true");
    const copy = element(
      "span",
      "pae-signal-copy",
      detailed ? item.detailedText : item.shortText
    );
    const impact = impactText(item.impact);
    const impactNode = element("span", "pae-impact", impact);
    impactNode.setAttribute("aria-label", ui.pointImpact(impact));
    listItem.append(marker, copy, impactNode);
    list.append(listItem);
  }
  return list;
}

function renderHighlights(
  container: HTMLElement,
  items: EvidenceItems,
  ui: UiCopy
): void {
  const section = element("section", "pae-section pae-highlights");
  section.append(element("h3", undefined, ui.evidenceHighlights));
  const highlights = highlightItems(items);
  if (highlights.length === 0) {
    section.append(element("p", "pae-empty", ui.noSupportingEvidence));
  } else {
    section.append(renderSignalList(highlights, ui, false));
  }
  container.append(section);
}

function renderDetailedGroup(
  heading: string,
  items: readonly SignalItem[],
  ui: UiCopy,
  tone: SignalItem["tone"]
): HTMLElement | null {
  if (items.length === 0) return null;
  const section = element("section", `pae-detail-group pae-${tone}`);
  section.append(
    element("h4", undefined, heading),
    renderSignalList(items, ui, true)
  );
  return section;
}

function renderExpandedDetails(
  container: HTMLElement,
  items: EvidenceItems,
  ui: UiCopy
): void {
  const details = element("div", "pae-expanded-details");
  const supporting = renderDetailedGroup(
    ui.supportingEvidence,
    items.supporting,
    ui,
    "supporting"
  );
  const caution = renderDetailedGroup(
    ui.cautionEvidence,
    items.caution,
    ui,
    "caution"
  );
  const informational = renderDetailedGroup(
    ui.additionalContext,
    items.informational,
    ui,
    "informational"
  );
  if (supporting) details.append(supporting);
  if (caution) details.append(caution);
  if (informational) details.append(informational);
  if (items.unavailableCount > 0) {
    details.append(element(
      "p",
      "pae-unavailable",
      ui.unavailableChecks(items.unavailableCount)
    ));
  }
  container.append(details);
}

export function renderEvidenceCard(
  container: HTMLElement,
  result: ScoreResult,
  ui: UiCopy,
  locale: SupportedUiLocale,
  options: EvidenceCardOptions = {}
): void {
  container.replaceChildren();
  const view = options.view ?? "preview";
  const items = signalItems(result, locale);

  renderSummary(container, result, ui, options);
  renderHighlights(container, items, ui);

  if (view === "expanded") {
    renderExpandedDetails(container, items, ui);
  }

  if (options.pinned) {
    const disclosure = element(
      "button",
      "pae-disclosure",
      view === "expanded" ? ui.showLess : ui.allSignals
    );
    disclosure.type = "button";
    disclosure.setAttribute("aria-expanded", String(view === "expanded"));
    disclosure.addEventListener("click", () => options.onToggleExpanded?.());
    container.append(disclosure);
  }

  container.append(element("p", "pae-disclaimer", ui.conciseEvidenceDisclaimer));
}

/** Backward-compatible renderer for consumers that only need the card body. */
export function renderCompactBreakdown(
  container: HTMLElement,
  result: ScoreResult,
  ui: UiCopy,
  locale: SupportedUiLocale,
  options: EvidenceCardOptions = {}
): void {
  renderEvidenceCard(container, result, ui, locale, options);
}
