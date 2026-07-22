import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEmptyProfileEvidence,
  observedObservation
} from "../../src/scoring/evidence-schema";
import { evaluateProfileEvidence } from "../../src/scoring/evaluate";
import { renderPopup, type PopupActions } from "../../src/ui/popup";

describe("extension popup", () => {
  let root: HTMLElement;
  let actions: PopupActions;

  beforeEach(() => {
    document.body.innerHTML = '<main id="app"></main>';
    root = document.querySelector("#app")!;
    actions = {
      enable: vi.fn(),
      disable: vi.fn(),
      setLocale: vi.fn()
    };
  });

  it("shows a compact automatic-scoring switch without a consent wall", () => {
    renderPopup(
      root,
      {
        preferences: {
          enabled: false,
          uiLocale: "auto",
          acceptedDisclosureVersion: null
        },
        locale: "en",
        state: null,
        connectionError: false
      },
      actions
    );

    expect(root.textContent).toContain("Profile Prism");
    expect(root.textContent).toContain("On-device only");
    expect(root.textContent).toContain("Automatic scoring");
    expect(root.textContent).toContain("Automatic scoring is off");
    expect(root.textContent).not.toContain("score appears automatically beside the name");
    expect(root.textContent).not.toContain("temporarily processes it in browser memory");
    expect(root.querySelector<HTMLImageElement>(".brand-mark")?.src).toContain("icons/icon-48.png");
    const toggle = root.querySelector<HTMLButtonElement>('[role="switch"]')!;
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    toggle.click();
    expect(actions.enable).toHaveBeenCalledOnce();
    expect(root.querySelector('a[href="privacy-policy.html"]')).not.toBeNull();
    expect(root.querySelector('a[href="data-inventory.html"]')).not.toBeNull();
  });

  it("uses native keyboard controls and politely announces contextual status", () => {
    renderPopup(
      root,
      {
        preferences: {
          enabled: true,
          uiLocale: "en",
          acceptedDisclosureVersion: "2026-07-16"
        },
        locale: "en",
        state: {
          status: "ready",
          badgeMounted: true,
          scanStatus: { phase: "scanning" }
        },
        connectionError: false
      },
      actions
    );

    const toggle = root.querySelector<HTMLButtonElement>('[role="switch"]')!;
    const status = root.querySelector<HTMLElement>('[role="status"]')!;
    const select = root.querySelector<HTMLSelectElement>("#ui-locale")!;
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle.type).toBe("button");
    expect(toggle.getAttribute("aria-label")).toBeTruthy();
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("Scanning profile…");
    expect(select.tagName).toBe("SELECT");
    expect(root.querySelector<HTMLLabelElement>('label[for="ui-locale"]')).not.toBeNull();
  });

  it("shows only status and settings even when a score is available", () => {
    const evidence = createEmptyProfileEvidence();
    evidence.identityVerification = observedObservation(
      "active",
      "fixture:identity"
    );
    const result = evaluateProfileEvidence(evidence);

    renderPopup(
      root,
      {
        preferences: {
          enabled: true,
          uiLocale: "en",
          acceptedDisclosureVersion: "2026-07-16"
        },
        locale: "en",
        state: { status: "ready", result, badgeMounted: true },
        connectionError: false
      },
      actions
    );

    expect(root.textContent).toContain("Profile ready");
    expect(root.textContent).not.toContain(`${result.score}/ 100`);
    expect(root.textContent).not.toContain("LinkedIn identity verification");
    expect(root.querySelector(".score")).toBeNull();
    const toggle = root.querySelector<HTMLButtonElement>('[role="switch"]')!;
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    toggle.click();
    expect(actions.disable).toHaveBeenCalledOnce();
  });

  it.each([
    ["available", "Profile ready", "success"],
    ["scanning", "Scanning profile…", "quiet"],
    ["complete", "Visible profile scanned", "success"],
    ["partial", "Scan incomplete", "warning"],
    ["cancelled", "Scan incomplete", "warning"],
    ["failed", "Scan incomplete", "warning"]
  ] as const)("shows concise %s scan context without exposing the score", (phase, text, tone) => {
    const evidence = createEmptyProfileEvidence();
    evidence.identityVerification = observedObservation("active", "fixture:identity");
    const result = evaluateProfileEvidence(evidence);

    renderPopup(
      root,
      {
        preferences: {
          enabled: true,
          uiLocale: "en",
          acceptedDisclosureVersion: "2026-07-16"
        },
        locale: "en",
        state: {
          status: phase === "failed" ? "error" : "ready",
          result,
          badgeMounted: true,
          scanStatus: { phase }
        },
        connectionError: false
      },
      actions
    );

    const status = root.querySelector<HTMLElement>(".page-status")!;
    expect(status.textContent).toBe(text);
    expect(status.classList.contains(tone)).toBe(true);
    expect(status.textContent).not.toContain(String(result.score));
    expect(root.textContent).not.toContain("LinkedIn profile verification badge");
  });

  it.each([
    ["pt", "privacy-policy-pt.html", "data-inventory-pt.html"],
    ["es", "privacy-policy-es.html", "data-inventory-es.html"]
  ] as const)("links the %s UI to localized privacy material", (locale, policy, inventory) => {
    renderPopup(
      root,
      {
        preferences: {
          enabled: true,
          uiLocale: locale,
          acceptedDisclosureVersion: null
        },
        locale,
        state: { status: "unsupported" },
        connectionError: false
      },
      actions
    );

    expect(root.querySelector(`a[href="${policy}"]`)).not.toBeNull();
    expect(root.querySelector(`a[href="${inventory}"]`)).not.toBeNull();
  });
});
