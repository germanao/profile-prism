import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEmptyProfileEvidence,
  observedObservation
} from "../../src/scoring/evidence-schema";
import { evaluateProfileEvidence } from "../../src/scoring/evaluate";
import {
  FAB_HOST_ATTRIBUTE,
  FAB_HOST_VALUE,
  mountScanFab,
  type ScanFabController
} from "../../src/ui/fab";
import { FAB_STYLES } from "../../src/ui/styles";

function result() {
  const evidence = createEmptyProfileEvidence();
  evidence.identityVerification = observedObservation("active", "fixture:identity");
  evidence.workHistoryDetail = observedObservation(
    "several_substantive_dated_roles",
    "fixture:experience"
  );
  evidence.careerChronology = observedObservation("rich_coherent", "fixture:chronology");
  evidence.coreCompleteness = observedObservation(
    "several_substantive_sections",
    "fixture:completeness"
  );
  return evaluateProfileEvidence(evidence);
}

describe("visible-profile scan FAB", () => {
  let controller: ScanFabController | undefined;

  beforeEach(() => {
    document.body.replaceChildren();
  });

  afterEach(() => {
    controller?.destroy();
    controller = undefined;
    document.querySelectorAll(`[${FAB_HOST_ATTRIBUTE}], [data-profile-authenticity-overlay]`)
      .forEach((element) => element.remove());
    vi.useRealTimers();
  });

  it("starts from the available state with a keyboard-sized automatic scan action", () => {
    const start = vi.fn();
    controller = mountScanFab({ state: "available", locale: "en", result: result() }, { start });

    expect(controller.host.getAttribute(FAB_HOST_ATTRIBUTE)).toBe(FAB_HOST_VALUE);
    expect(controller.host.dataset.state).toBe("available");
    expect(controller.trigger.textContent).toBe(
      `${result().score} - Click to verify authenticity`
    );
    expect(controller.trigger.getAttribute("aria-label")).toBe(
      `Verify authenticity. Current score ${result().score} out of 100`
    );
    expect(controller.trigger.getAttribute("aria-haspopup")).toBe("dialog");
    controller.trigger.click();
    expect(start).toHaveBeenCalledOnce();
  });

  it("announces each scan-state update through one atomic polite live region", () => {
    const score = result();
    controller = mountScanFab({ state: "available", locale: "en", result: score });

    const live = controller.host.shadowRoot?.querySelector<HTMLElement>(".pae-sr-only")!;
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.getAttribute("aria-atomic")).toBe("true");
    expect(live.textContent).toContain("Profile ready");
    expect(live.textContent).toContain("Verify authenticity");

    controller.update({ state: "scanning", locale: "en", result: score });
    expect(live.textContent).toContain("Scanning visible profile");

    controller.update({ state: "complete", locale: "en", result: score });
    expect(live.textContent).toContain("Full visible profile scanned");
  });

  it("shows scanning progress and cancels on either activation or the explicit cancel control", () => {
    const cancel = vi.fn();
    controller = mountScanFab(
      { state: "scanning", locale: "en", result: result() },
      { cancel }
    );

    expect(controller.host.shadowRoot?.querySelector(".pae-spinner")).not.toBeNull();
    expect(controller.trigger.textContent).toContain("Scanning…");
    expect(controller.trigger.getAttribute("aria-label")).toContain("Cancel scan");
    controller.trigger.click();
    controller.host.shadowRoot?.querySelector<HTMLButtonElement>(".pae-fab-aux")?.click();
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it("shares the evidence card, reports a full scan, and compacts completion after four seconds", () => {
    vi.useFakeTimers();
    const score = result();
    controller = mountScanFab({
      state: "complete",
      locale: "en",
      result: score,
      checkedCount: 12,
      totalCount: 15
    });

    controller.trigger.focus();
    const overlay = document.querySelector<HTMLElement>(
      '[data-profile-authenticity-overlay="profile-evidence-details"]'
    )!;
    const card = overlay.shadowRoot?.querySelector<HTMLElement>(".pae-card")!;
    expect(card.hidden).toBe(false);
    expect(card.textContent).toContain("Full visible profile scanned");
    expect(card.textContent).toContain("12 of 15 evidence checks read");
    expect(card.textContent).toContain("Evidence index—not identity verification or a fraud decision.");

    controller.trigger.click();
    expect(card.dataset.mode).toBe("pinned");
    expect(card.textContent).toContain("All signals");

    vi.advanceTimersByTime(4000);
    expect(controller.host.getAttribute("data-compact")).toBe("true");
    expect(controller.host.shadowRoot?.querySelector(".pae-fab-score")?.textContent)
      .toBe(String(score.score));
    controller.hideEvidence();
    expect(card.hidden).toBe(true);
  });

  it.each(["cancelled", "failed"] as const)("retries from the %s state", (state) => {
    const retry = vi.fn();
    controller = mountScanFab({ state, locale: "en" }, { retry });
    expect(controller.trigger.textContent).toContain("Verify authenticity again");
    controller.trigger.click();
    expect(retry).toHaveBeenCalledOnce();
  });

  it("keeps the partial score visible while offering another attempt", () => {
    const retry = vi.fn();
    const score = result();
    controller = mountScanFab({ state: "partial", locale: "en", result: score }, { retry });
    expect(controller.trigger.textContent).toContain(String(score.score));
    expect(controller.trigger.textContent).toContain("Verify authenticity again");
    controller.trigger.click();
    expect(retry).toHaveBeenCalledOnce();
  });

  it("keeps keyboard focus visible and returns it to the FAB when Escape closes details", () => {
    controller = mountScanFab({ state: "complete", locale: "en", result: result() });
    const overlay = document.querySelector<HTMLElement>(
      '[data-profile-authenticity-overlay="profile-evidence-details"]'
    )!;
    const card = overlay.shadowRoot?.querySelector<HTMLElement>(".pae-card")!;

    controller.trigger.focus();
    expect(card.hidden).toBe(false);
    expect(controller.trigger.getAttribute("aria-expanded")).toBe("true");

    controller.trigger.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      composed: true
    }));

    expect(card.hidden).toBe(true);
    expect(controller.trigger.getAttribute("aria-expanded")).toBe("false");
    expect(controller.host.shadowRoot?.activeElement).toBe(controller.trigger);
  });

  it("encodes touch targets, responsive widths, contrast modes, and restrained motion", () => {
    expect(FAB_STYLES).toContain("min-block-size: 4.75rem");
    expect(FAB_STYLES).toContain("min-inline-size: 17.5rem");
    expect(FAB_STYLES).toContain("min-inline-size: 22.5rem");
    expect(FAB_STYLES).toContain("max-inline-size: min(28.75rem, calc(100vw - 2.5rem))");
    expect(FAB_STYLES).toContain("inline-size: calc(100vw - 1.5rem)");
    expect(FAB_STYLES).toContain("font-size: 1.375rem");
    expect(FAB_STYLES).toContain("font-size: 1.0625rem");
    expect(FAB_STYLES).toContain("max-inline-size: calc(100vw - 2.5rem)");
    expect(FAB_STYLES).toContain("max-inline-size: min(21.25rem, calc(100vw - 7rem))");
    expect(FAB_STYLES).toContain("backdrop-filter: blur(20px) saturate(160%)");
    expect(FAB_STYLES).toContain(".pae-fab:focus-visible");
    expect(FAB_STYLES).toContain(".pae-fab-aux:focus-visible");

    expect(FAB_STYLES).toContain("@media (prefers-color-scheme: dark)");
    expect(FAB_STYLES).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(FAB_STYLES).toContain("@media (forced-colors: active)");
    expect(FAB_STYLES).toContain("@media (prefers-reduced-motion: reduce)");
    expect(FAB_STYLES).toContain(".pae-spinner { animation: none !important; }");
    expect(FAB_STYLES).toContain("scroll-behavior: auto !important");
    expect(FAB_STYLES).toContain("transition: none !important");
  });
});
