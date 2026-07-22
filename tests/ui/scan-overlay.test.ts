import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createScanOverlay,
  SCAN_OVERLAY_HOST_ATTRIBUTE,
  type ScanOverlayController,
  type ScanOverlayModel
} from "../../src/ui/scan-overlay";
import { SCAN_OVERLAY_STYLES } from "../../src/ui/styles";

function model(overrides: Partial<ScanOverlayModel> = {}): ScanOverlayModel {
  return {
    phase: "scanning",
    stage: "preparing",
    locale: "en",
    score: 58,
    checkedCount: 6,
    totalCount: 15,
    elapsedMs: 0,
    ...overrides
  };
}

describe("full-profile scan overlay", () => {
  let controller: ScanOverlayController | undefined;
  let origin: HTMLButtonElement;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
    origin = document.createElement("button");
    origin.textContent = "Full scan";
    document.body.append(origin);
  });

  afterEach(() => {
    controller?.destroy();
    controller = undefined;
    vi.useRealTimers();
  });

  it("shows truthful scanning progress, a live score, and an explicit cancel action", async () => {
    const cancel = vi.fn();
    controller = createScanOverlay(document, {
      cancel,
      retry: vi.fn()
    });
    controller.show(origin, model());
    await Promise.resolve();

    expect(controller.host.hidden).toBe(false);
    expect(controller.host.getAttribute(SCAN_OVERLAY_HOST_ATTRIBUTE)).toBe(
      "full-profile-progress"
    );
    const shadow = controller.host.shadowRoot!;
    const dialog = shadow.querySelector<HTMLElement>("[role='dialog']")!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-busy")).toBe("true");
    expect(dialog.textContent).toContain("How authentic is this profile?");
    expect(dialog.textContent).toContain("Preparing full scan");
    expect(dialog.textContent).toContain("Live estimate");
    expect(dialog.textContent).toContain("58/100");
    expect(dialog.textContent).toContain("6 of 15 evidence checks read");

    await vi.advanceTimersByTimeAsync(2_000);
    expect(dialog.textContent).toContain("2s elapsed");
    shadow.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true
    }));
    expect(cancel).toHaveBeenCalledOnce();
    [...shadow.querySelectorAll<HTMLButtonElement>(".pae-scan-button")]
      .find((button) => !button.hidden)!.click();
    expect(cancel).toHaveBeenCalledTimes(2);

    const wheel = new WheelEvent("wheel", { bubbles: true, cancelable: true });
    shadow.querySelector(".pae-scan-overlay")!.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it("closes immediately instead of presenting a terminal incomplete dialog", () => {
    const retry = vi.fn();
    controller = createScanOverlay(document, {
      cancel: vi.fn(),
      retry
    });
    controller.show(origin, model());
    controller.update(model({
      phase: "partial",
      stage: "settling",
      score: 73,
      checkedCount: 11,
      elapsedMs: 8_000,
      reason: "step-limit"
    }));

    expect(controller.host.hidden).toBe(true);
    expect(document.activeElement).toBe(origin);
    expect(retry).not.toHaveBeenCalled();
  });

  it("confirms completion, dismisses after 1.2 seconds, and restores FAB focus", async () => {
    controller = createScanOverlay(document, {
      cancel: vi.fn(),
      retry: vi.fn()
    });
    controller.show(origin, model());
    controller.update(model({
      phase: "complete",
      stage: "returning",
      score: 91,
      checkedCount: 15,
      elapsedMs: 9_000
    }));

    const dialog = controller.host.shadowRoot!.querySelector<HTMLElement>("[role='dialog']")!;
    expect(dialog.textContent).toContain("Score updated");
    expect(dialog.textContent).toContain("91/100");

    await vi.advanceTimersByTimeAsync(1_400);
    expect(controller.host.hidden).toBe(true);
    expect(document.activeElement).toBe(origin);
  });

  it("supports modal accessibility and display preferences", () => {
    expect(SCAN_OVERLAY_STYLES).toContain("z-index: 2147483647");
    expect(SCAN_OVERLAY_STYLES).toContain(
      "inline-size: min(40rem, calc(100vw - 2rem))"
    );
    expect(SCAN_OVERLAY_STYLES).toContain("padding: 2.25rem");
    expect(SCAN_OVERLAY_STYLES).toContain("font-size: 1.75rem");
    expect(SCAN_OVERLAY_STYLES).toContain("font-size: 1.25rem");
    expect(SCAN_OVERLAY_STYLES).toContain("font-size: 3.5rem");
    expect(SCAN_OVERLAY_STYLES).toContain("block-size: 4.75rem");
    expect(SCAN_OVERLAY_STYLES).toContain("block-size: 0.625rem");
    expect(SCAN_OVERLAY_STYLES).toContain("min-block-size: 3.25rem");
    expect(SCAN_OVERLAY_STYLES).toContain("@media (prefers-color-scheme: dark)");
    expect(SCAN_OVERLAY_STYLES).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(SCAN_OVERLAY_STYLES).toContain("@media (prefers-reduced-motion: reduce)");
    expect(SCAN_OVERLAY_STYLES).toContain("@media (forced-colors: active)");
  });
});
