import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEmptyProfileEvidence,
  observedObservation
} from "../../src/scoring/evidence-schema";
import { evaluateProfileEvidence } from "../../src/scoring/evaluate";
import {
  createEvidencePopover,
  type EvidencePopoverController,
  type ScoreSurfacePresentationModel
} from "../../src/ui/evidence-popover";
import { EVIDENCE_POPOVER_STYLES } from "../../src/ui/styles";

function presentation(): ScoreSurfacePresentationModel {
  const evidence = createEmptyProfileEvidence();
  evidence.identityVerification = observedObservation("active", "fixture:identity");
  evidence.accountAge = observedObservation({ days: 12 }, "fixture:age");
  evidence.workHistoryDetail = observedObservation(
    "several_substantive_dated_roles",
    "fixture:work"
  );
  evidence.careerChronology = observedObservation("rich_coherent", "fixture:chronology");
  evidence.crossSectionConsistency = observedObservation(
    "strong_alignment",
    "fixture:consistency"
  );
  evidence.coreCompleteness = observedObservation(
    "several_substantive_sections",
    "fixture:completeness"
  );
  return {
    result: evaluateProfileEvidence(evidence),
    locale: "en",
    tone: "supporting",
    scanState: "available",
    mode: "initial",
    checkedCount: 6,
    totalCount: 15
  };
}

describe("shared evidence popover", () => {
  let controller: EvidencePopoverController;
  let first: HTMLButtonElement;
  let second: HTMLButtonElement;

  beforeEach(() => {
    document.querySelectorAll("[data-profile-authenticity-overlay]").forEach((node) => node.remove());
    document.body.replaceChildren();
    first = document.createElement("button");
    second = document.createElement("button");
    document.body.append(first, second);
    controller = createEvidencePopover(document);
  });

  afterEach(() => {
    controller.destroy();
    vi.restoreAllMocks();
  });

  it("attaches page-level scroll handling only while evidence is visible", () => {
    controller.destroy();
    const addListener = vi.spyOn(window, "addEventListener");
    const removeListener = vi.spyOn(window, "removeEventListener");
    controller = createEvidencePopover(document);

    expect(addListener.mock.calls.some(([type]) => type === "scroll")).toBe(false);
    controller.show(first, presentation());
    expect(addListener.mock.calls.some(([type]) => type === "scroll")).toBe(true);

    controller.hide({ immediate: true, force: true });
    expect(removeListener.mock.calls.some(([type]) => type === "scroll")).toBe(true);
  });

  it("reuses one overlay and limits the transient preview to three short signals", () => {
    const model = presentation();
    controller.show(first, model);

    expect(document.querySelectorAll(
      '[data-profile-authenticity-overlay="profile-evidence-details"]'
    )).toHaveLength(1);
    expect(controller.card.hidden).toBe(false);
    expect(controller.card.dataset.mode).toBe("preview");
    const highlights = controller.card.querySelectorAll(".pae-list-highlights .pae-signal");
    expect(highlights.length).toBeLessThanOrEqual(3);
    expect(controller.card.textContent).toContain(
      "How authentic is this profile?"
    );
    expect(controller.card.textContent).toContain("Evidence highlights");
    expect(controller.card.textContent).not.toContain("Several substantive roles with dates");

    controller.show(second, { ...model, scanState: "scanning" });
    expect(controller.currentAnchor).toBe(second);
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(second.getAttribute("aria-expanded")).toBe("true");
  });

  it("pins, expands all signals, ignores hover replacement, and dismisses outside", () => {
    const model = presentation();
    controller.pin(first, model);
    expect(controller.mode).toBe("pinned");
    expect(controller.card.textContent).toContain("All signals");

    controller.show(second, model);
    expect(controller.currentAnchor).toBe(first);

    controller.card.querySelector<HTMLButtonElement>(".pae-disclosure")?.click();
    expect(controller.card.dataset.view).toBe("expanded");
    expect(controller.card.textContent).toContain("Several substantive roles with dates");
    expect(controller.card.querySelector(".pae-expanded-details")).not.toBeNull();

    document.body.dispatchEvent(new MouseEvent("pointerdown", {
      bubbles: true,
      composed: true
    }));
    expect(controller.card.hidden).toBe(true);
    expect(first.getAttribute("aria-expanded")).toBe("false");
  });

  it("returns focus to the source when Escape closes the popover", () => {
    controller.pin(first, presentation());
    second.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      composed: true
    }));
    expect(controller.card.hidden).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it("uses the full pinned-card width below the close-button header", () => {
    expect(EVIDENCE_POPOVER_STYLES).not.toContain(
      '.pae-card[data-mode="pinned"] .pae-card-content { padding-inline-end: 2.25rem; }'
    );
    expect(EVIDENCE_POPOVER_STYLES).toContain(
      '.pae-card[data-mode="pinned"] .pae-scan-mode,'
    );
    expect(EVIDENCE_POPOVER_STYLES).toContain(
      '.pae-card[data-mode="pinned"] .pae-score-summary'
    );
  });
});
