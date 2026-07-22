import { beforeEach, describe, expect, it } from "vitest";
import {
  createEmptyProfileEvidence,
  observedObservation
} from "../../src/scoring/evidence-schema";
import { evaluateProfileEvidence } from "../../src/scoring/evaluate";
import {
  BADGE_HOST_ATTRIBUTE,
  BADGE_HOST_VALUE,
  findProfileNameAnchor,
  mountBadge,
  scoreColorBand
} from "../../src/ui/badge";
import {
  BADGE_STYLES,
  EVIDENCE_POPOVER_STYLES
} from "../../src/ui/styles";

function evidenceResult() {
  const evidence = createEmptyProfileEvidence();
  evidence.identityVerification = observedObservation(
    "active",
    "fixture:identity"
  );
  evidence.accountAge = observedObservation(
    { days: 12 },
    "fixture:account-age"
  );
  return evaluateProfileEvidence(evidence);
}

describe("in-page evidence badge", () => {
  beforeEach(() => {
    history.replaceState({}, "", "/in/ada-lovelace/");
    document.querySelectorAll("[data-profile-authenticity-overlay]").forEach((node) => node.remove());
    document.body.innerHTML = "<main><h1>Ada Lovelace</h1></main>";
  });

  it.each([
    [0, "red"],
    [30, "red"],
    [31, "orange"],
    [50, "orange"],
    [51, "yellow"],
    [70, "yellow"],
    [71, "yellow"],
    [88, "yellow"],
    [89, "green"],
    [100, "green"]
  ] as const)("maps score %s to the %s meter range", (score, band) => {
    expect(scoreColorBand(score)).toBe(band);
  });

  it("mounts adjacent to a safe semantic name anchor and remains idempotent", () => {
    const anchor = findProfileNameAnchor(document);
    expect(anchor?.textContent).toBe("Ada Lovelace");
    const result = evidenceResult();

    mountBadge(anchor!, result, "en");
    mountBadge(anchor!, result, "en");

    const hosts = document.querySelectorAll(
      `[${BADGE_HOST_ATTRIBUTE}="${BADGE_HOST_VALUE}"]`
    );
    expect(hosts).toHaveLength(1);
    expect(hosts[0]?.parentElement).toBe(anchor);
    const trigger = hosts[0]?.shadowRoot?.querySelector("button.pae-badge");
    expect(trigger?.textContent).toContain(String(result.score));
    expect(trigger?.getAttribute("aria-label")).toContain("out of 100");
    expect(trigger?.getAttribute("data-score-band")).toBe(scoreColorBand(result.score));
    const scoreGroup = trigger?.querySelector(".pae-score-group");
    expect(scoreGroup?.querySelector(".pae-value")?.textContent).toBe(String(result.score));
    expect(scoreGroup?.querySelector(".pae-scale")?.textContent).toBe("/100");
  });

  it("finds LinkedIn's linked H2 name and mounts in the outer flex name row", () => {
    document.body.innerHTML = `
      <main>
        <div id="name-row" style="display:flex;align-items:center">
          <div id="name-block">
            <div>
              <a href="/in/ada-lovelace/" style="display:flex">
                <div><h2>Ada Lovelace</h2><span aria-label="View Ada's verifications"></span></div>
              </a>
            </div>
          </div>
        </div>
      </main>`;

    const anchor = findProfileNameAnchor(document);
    expect(anchor?.tagName).toBe("H2");
    const controller = mountBadge(anchor!, evidenceResult(), "en");
    const nameRow = document.querySelector("#name-row")!;
    expect(nameRow.children[0]?.id).toBe("name-block");
    expect(nameRow.children[1]).toBe(controller.host);
  });

  it("finds an unlinked H2 in the current profile's top card", () => {
    document.body.innerHTML = `
      <main>
        <section>
          <div id="name-row" style="display:flex;align-items:center">
            <h2>Douglas Marques</h2>
          </div>
          <a href="/in/ada-lovelace/overlay/contact-info/">Contact info</a>
        </section>
        <section>
          <h2>About</h2>
        </section>
      </main>`;

    const anchor = findProfileNameAnchor(document);
    expect(anchor?.textContent).toBe("Douglas Marques");
    expect(anchor?.tagName).toBe("H2");
  });

  it("prefers the signaled name card over a generic About profile card", () => {
    document.body.innerHTML = `
      <main>
        <section id="top-card">
          <img alt="Marcos Esmeraldino profile photo">
          <div id="name-row" style="display:flex;align-items:center">
            <h2>Marcos Esmeraldino</h2>
            <span>He/Him · 1st</span>
          </div>
          <p>Senior Software Engineer | Java Backend</p>
          <button>Contact info</button>
          <span>500+ connections</span>
          <button>Message</button>
        </section>
        <section><h2>Highlights</h2></section>
        <section id="about-card" data-view-name="profile-card">
          <h2>About</h2>
          <p>Building software for financial institutions.</p>
        </section>
      </main>`;

    const anchor = findProfileNameAnchor(document);
    expect(anchor?.textContent).toBe("Marcos Esmeraldino");
    const controller = mountBadge(anchor!, evidenceResult(), "en");
    expect(controller.host.closest("section")?.id).toBe("top-card");
    expect(document.querySelector("#about-card")?.contains(controller.host))
      .toBe(false);
  });

  it("never treats a generic About profile card as the name anchor", () => {
    document.body.innerHTML = `
      <main>
        <section data-view-name="profile-card">
          <h2>About</h2>
          <p>Senior engineer with 500+ connections.</p>
        </section>
      </main>`;

    expect(findProfileNameAnchor(document)).toBeNull();
  });

  it("does not mistake an unrelated unlinked H2 for the profile name", () => {
    document.body.innerHTML = `
      <main>
        <section><h2>About</h2></section>
        <section><h2>Activity</h2></section>
      </main>`;

    expect(findProfileNameAnchor(document)).toBeNull();
  });

  it("declines an ambiguous heading anchor", () => {
    document.querySelector("main")?.append(document.createElement("h1"));
    const headings = document.querySelectorAll("h1");
    headings[1]!.textContent = "Another heading";
    expect(findProfileNameAnchor(document)).toBeNull();
  });

  it("ignores headings hidden by an ancestor or a stylesheet", () => {
    const main = document.querySelector("main")!;
    const hiddenBranch = document.createElement("section");
    hiddenBranch.hidden = true;
    hiddenBranch.innerHTML = "<h1>Hidden duplicate</h1>";
    const cssHidden = document.createElement("h1");
    cssHidden.className = "css-hidden";
    cssHidden.textContent = "Experiment duplicate";
    const style = document.createElement("style");
    style.textContent = ".css-hidden { display: none; }";
    main.append(hiddenBranch, cssHidden, style);

    expect(findProfileNameAnchor(document)?.textContent).toBe("Ada Lovelace");
  });

  it("gives keyboard users the same concise hover details outside the clipped header", () => {
    const anchor = findProfileNameAnchor(document)!;
    const result = evidenceResult();
    const controller = mountBadge(anchor, result, "en");
    const shadow = controller.host.shadowRoot!;
    const trigger = shadow.querySelector<HTMLButtonElement>("button.pae-badge")!;
    const overlay = document.querySelector<HTMLElement>(
      "[data-profile-authenticity-overlay='profile-evidence-details']"
    )!;
    const card = overlay.shadowRoot!.querySelector<HTMLElement>("#pae-evidence-popover")!;

    trigger.focus();
    expect(card.hidden).toBe(false);
    expect(overlay.getAttribute("aria-hidden")).toBe("false");
    expect(card.textContent).toContain("How authentic is this profile?");
    expect(card.textContent).toContain("Initial estimate");
    expect(card.textContent).toContain("evidence checks read");
    expect(card.textContent).toMatch(/[+−]\d/);
    expect(card.textContent).toContain("Evidence highlights");
    expect(card.textContent).toContain("Evidence index—not identity verification or a fraud decision.");
    expect(card.textContent).not.toContain("have not lowered the score");
    expect(card.textContent).not.toContain("Work-history detail and specificity was not visible");

    trigger.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      composed: true
    }));
    expect(card.hidden).toBe(true);
    expect(overlay.getAttribute("aria-hidden")).toBe("true");
  });

  it("pins the preview and lets keyboard users move into all signals", async () => {
    const evidence = createEmptyProfileEvidence();
    evidence.identityVerification = observedObservation("active", "fixture:identity");
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

    const controller = mountBadge(
      findProfileNameAnchor(document)!,
      evaluateProfileEvidence(evidence),
      "en"
    );
    const trigger = controller.host.shadowRoot!.querySelector<HTMLButtonElement>(
      "button.pae-badge"
    )!;
    const overlay = document.querySelector<HTMLElement>(
      "[data-profile-authenticity-overlay='profile-evidence-details']"
    )!;
    const overlayShadow = overlay.shadowRoot!;
    const card = overlayShadow.querySelector<HTMLElement>(".pae-card")!;

    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true
    }));

    await Promise.resolve();
    const disclosure = overlayShadow.querySelector<HTMLButtonElement>(".pae-disclosure")!;
    expect(card.dataset.mode).toBe("pinned");
    expect(disclosure.textContent).toBe("All signals");
    expect(overlayShadow.activeElement).toBe(disclosure);

    disclosure.click();
    expect(card.dataset.view).toBe("expanded");
    expect(card.textContent).toContain("Several substantive roles with dates");
  });

  it("keeps the badge and evidence card accessible across zoom and display preferences", () => {
    expect(BADGE_STYLES).toContain("min-block-size: 3.5rem");
    expect(BADGE_STYLES).toContain("min-inline-size: 7.25rem");
    expect(BADGE_STYLES).toContain("font-size: 1.5rem");
    expect(BADGE_STYLES).toContain('[data-score-band="red"]');
    expect(BADGE_STYLES).toContain('[data-score-band="orange"]');
    expect(BADGE_STYLES).toContain('[data-score-band="yellow"]');
    expect(BADGE_STYLES).toContain('[data-score-band="green"]');
    expect(BADGE_STYLES).toContain("backdrop-filter: blur(20px) saturate(160%)");
    expect(BADGE_STYLES).toContain(".pae-score-group");
    expect(BADGE_STYLES).toContain("align-items: baseline");
    expect(BADGE_STYLES).toContain(".pae-badge:focus-visible");
    expect(EVIDENCE_POPOVER_STYLES).toContain("inline-size: min(23.75rem, calc(100vw - 1.5rem))");
    expect(EVIDENCE_POPOVER_STYLES).toContain("max-block-size: min(35rem, calc(100vh - 1.5rem))");
    expect(EVIDENCE_POPOVER_STYLES).toContain("max-block-size: min(20rem, 42vh)");

    expect(BADGE_STYLES).toContain("@media (prefers-color-scheme: dark)");
    expect(BADGE_STYLES).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(BADGE_STYLES).toContain("@media (forced-colors: active)");
    expect(BADGE_STYLES).toContain("@media (prefers-reduced-motion: reduce)");
    expect(BADGE_STYLES).toContain("scroll-behavior: auto !important");
    expect(BADGE_STYLES).toContain("transition: none !important");
  });
});
