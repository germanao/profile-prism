import { beforeEach, describe, expect, it } from "vitest";
import { extractAboutMemberFacts, mergeAboutMemberFacts } from "../../src/extractors/about-member";
import { getExtractionDictionary } from "../../src/locales/extraction";
import { createEmptyProfileEvidence, observedObservation } from "../../src/scoring/evidence-schema";

const NOW = new Date("2026-07-16T12:00:00Z");

beforeEach(() => {
  document.body.replaceChildren();
});

function dialog(html: string): HTMLElement {
  document.body.innerHTML = `<div role="dialog" data-complete="true"><ul>${html}</ul></div>`;
  return document.querySelector<HTMLElement>("[role='dialog']")!;
}

describe("About this member structured extraction", () => {
  it("parses English government-ID, current-workplace, tenure, and maintenance facts", () => {
    const root = dialog(`
      <li data-pe-verification-method="government-id" data-pe-verification-date="August 2025">
        Verified using government ID issued in the European Economic Area/Switzerland in August 2025
      </li>
      <li data-pe-verification-method="work-email" data-pe-verification-date="January 2025">
        Work email verified at Synthetic Systems in January 2025
      </li>
      <li>Joined LinkedIn in March 2011</li>
      <li data-pe-updated-days="20">Contact information updated 20 days ago</li>
      <li data-pe-updated-days="500">Profile photo updated more than one year ago</li>
    `);
    const facts = extractAboutMemberFacts(root, getExtractionDictionary("en"), {
      now: NOW,
      currentEmployer: "Synthetic Systems",
    });

    expect(facts.verificationDetails).toMatchObject({
      state: "observed",
      value: {
        governmentId: true,
        workplace: true,
        workplaceMatch: "current",
        education: false,
      },
    });
    if (facts.verificationDetails.state === "observed") {
      expect(facts.verificationDetails.value.verificationAgeDays).toBeGreaterThan(365);
    }
    expect(facts.accountAge).toMatchObject({ state: "observed" });
    expect(facts.profileMaintenance).toMatchObject({
      state: "observed",
      value: { contactUpdatedDays: 20, photoUpdatedDays: 500 },
    });
    expect(JSON.stringify(facts)).not.toContain("Synthetic Systems");
  });

  it("parses Portuguese facts without retaining the institution name", () => {
    const root = dialog(`
      <li>Verificado com documento de identidade em junho de 2024</li>
      <li data-pe-verification-method="education">Formação verificada pela Universidade Sintética</li>
      <li>Entrou no LinkedIn em fevereiro de 2014</li>
      <li data-pe-updated-days="240">Informações de contato atualizadas há 8 meses</li>
    `);
    const facts = extractAboutMemberFacts(root, getExtractionDictionary("pt"), { now: NOW });

    expect(facts.verificationDetails).toMatchObject({
      state: "observed",
      value: { governmentId: true, workplace: false, education: true },
    });
    expect(facts.accountAge.state).toBe("observed");
    expect(facts.profileMaintenance).toMatchObject({
      state: "observed",
      value: { contactUpdatedDays: 240 },
    });
    expect(JSON.stringify(facts)).not.toContain("Universidade Sintética");
  });

  it("parses Spanish work verification and keeps an unmatched employer unresolved", () => {
    const root = dialog(`
      <li>Correo laboral verificado en Empresa Anterior en mayo de 2025</li>
      <li>Se unió a LinkedIn en septiembre de 2012</li>
      <li data-pe-updated-days="366">Foto de perfil actualizada hace más de un año</li>
    `);
    const facts = extractAboutMemberFacts(root, getExtractionDictionary("es"), {
      now: NOW,
      currentEmployer: "Empresa Actual",
    });

    expect(facts.verificationDetails).toMatchObject({
      state: "observed",
      value: {
        governmentId: false,
        workplace: true,
        workplaceMatch: "former_or_unresolved",
        education: false,
      },
    });
    expect(facts.profileMaintenance).toMatchObject({
      state: "observed",
      value: { photoUpdatedDays: 366 },
    });
  });

  it("uses a compact heading-and-paragraph row to classify maintenance recency", () => {
    document.body.innerHTML = `
      <div role="dialog" data-complete="true">
        <section>
          <div><h3>Contact info</h3><p>Last updated less than 1 month ago</p></div>
          <div><h3>Profile photo</h3><p>Last updated more than one year ago</p></div>
        </section>
      </div>`;
    const facts = extractAboutMemberFacts(
      document.querySelector<HTMLElement>("[role='dialog']")!,
      getExtractionDictionary("en"),
      { now: NOW },
    );

    expect(facts.profileMaintenance).toMatchObject({
      state: "observed",
      value: { contactUpdatedDays: 30, photoUpdatedDays: 366 },
    });
  });

  it("does not turn a verification invitation into a completed method", () => {
    const root = dialog(`<li>Get verified using a government ID</li>`);
    expect(extractAboutMemberFacts(root, getExtractionDictionary("en"), { now: NOW })
      .verificationDetails).toMatchObject({
      state: "observed",
      value: { governmentId: false, workplace: false, education: false },
    });
  });

  it("merges structured facts without allowing unavailable data to erase observations", () => {
    const base = createEmptyProfileEvidence("fixture:base");
    base.accountAge = observedObservation({ days: 3_000 }, "fixture:existing");
    const facts = extractAboutMemberFacts(
      dialog(`<li>Government ID verification is available</li>`),
      getExtractionDictionary("en"),
      { now: NOW },
    );
    const merged = mergeAboutMemberFacts(base, facts);
    expect(merged.accountAge).toEqual(base.accountAge);
    expect(merged).not.toHaveProperty("dialogText");
    expect(merged).not.toHaveProperty("organization");
  });
});
