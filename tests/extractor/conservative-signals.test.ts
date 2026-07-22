import { beforeEach, describe, expect, it } from "vitest";
import {
  getExtractionDictionary,
  type ExtractionDictionary
} from "../../src/locales/extraction";
import { extractRecommendations } from "../../src/extractors/recommendations";
import { extractTopCardFacts } from "../../src/extractors/top-card";
import { extractVerificationFacts } from "../../src/extractors/verification";

const NOW = new Date("2026-07-16T12:00:00Z");

beforeEach(() => {
  document.documentElement.lang = "en";
  document.body.replaceChildren();
});

describe("conservative verification extraction", () => {
  it("does not treat an English verification invitation as completed", () => {
    const dictionary = getExtractionDictionary("en");
    document.body.innerHTML = `
      <main><section><h1>Invitation Example</h1>
        <button aria-label="Get your identity verified">Get your identity verified</button>
      </section></main>`;

    expect(extractVerificationFacts(document, dictionary).identity.state).not.toBe(
      "observed"
    );
  });

  it("recognizes a native verification icon beside a classic H1", () => {
    const dictionary = getExtractionDictionary("en");
    document.body.innerHTML = `
      <main><section><div style="display:flex">
        <h1>Verified Example</h1>
        <svg role="img" aria-label="View Verified Example's verifications"></svg>
      </div></section></main>`;

    expect(extractVerificationFacts(document, dictionary).identity).toMatchObject({
      state: "observed",
      value: "active"
    });
  });

  it.each([
    {
      locale: "pt",
      invitation: "Verificação de identidade",
      completed: "Verificação de identidade concluída"
    },
    {
      locale: "es",
      invitation: "Verificación de identidad",
      completed: "Verificación de identidad completada"
    }
  ] as const)(
    "does not treat a noun-only $locale invitation as a completed verification",
    ({ locale, invitation, completed }) => {
      const dictionary = getExtractionDictionary(locale);
      document.body.innerHTML = `
        <aside data-pe-verification-panel>
          <button aria-label="${invitation}">${invitation}</button>
        </aside>`;

      expect(extractVerificationFacts(document, dictionary).identity.state).not.toBe(
        "observed"
      );

      document.body.innerHTML = `
        <aside data-pe-verification-panel>
          <span aria-label="${completed}">${completed}</span>
        </aside>`;
      expect(extractVerificationFacts(document, dictionary).workplaceEducation).toMatchObject({
        state: "observed",
        value: { governmentId: true }
      });
    }
  );

  it("does not let one completed kind complete a separate invitation", () => {
    const dictionary = getExtractionDictionary("pt");
    document.body.innerHTML = `
      <aside data-pe-verification-panel>
        <button aria-label="Verificação de identidade">Verificação de identidade</button>
        <span aria-label="Empresa verificada">Empresa verificada</span>
      </aside>`;

    const facts = extractVerificationFacts(document, dictionary);
    expect(facts.identity.state).not.toBe("observed");
    expect(facts.workplaceEducation).toMatchObject({
      state: "observed",
      value: { workplace: true, education: false }
    });
  });
});

function recommendationSection(texts: readonly string[]): void {
  const items = texts
    .map(
      (text, index) => `
        <article data-pe-item>
          <cite data-pe-field="author">Synthetic Author ${index + 1}</cite>
          <p data-pe-field="content">${text}</p>
        </article>`
    )
    .join("");
  document.body.innerHTML = `
    <section data-pe-section="recommendations">
      <h2>Recommendations</h2>
      ${items}
    </section>`;
}

function recommendations(dictionary?: ExtractionDictionary) {
  return extractRecommendations(
    document,
    dictionary ?? getExtractionDictionary("en")
  );
}

describe("conservative recommendation extraction", () => {
  const repeatedText =
    "Jordan consistently delivered reliable backend systems and collaborated thoughtfully with every member of our engineering team.";
  const distinctText =
    "During our accessibility migration, Jordan designed keyboard navigation tests and documented measurable improvements for customers.";

  it("keeps headings, author names, and trivial text unavailable", () => {
    recommendationSection(["Great colleague."]);
    expect(recommendations()).toMatchObject({
      state: "unavailable",
      source: "dom:recommendations:meaningful-content-not-rendered"
    });
  });

  it("allows positive coverage only when meaningful recommendation text is visible", () => {
    recommendationSection([distinctText]);
    expect(recommendations()).toMatchObject({
      state: "observed",
      value: "some"
    });
  });

  it("does not call one similar pair among three recommendations boilerplate", () => {
    recommendationSection([repeatedText, repeatedText, distinctText]);
    expect(recommendations()).toMatchObject({
      state: "observed",
      value: "some"
    });
  });

  it("requires a genuinely repeated set of at least three recommendations", () => {
    recommendationSection([repeatedText, repeatedText, repeatedText]);
    expect(recommendations()).toMatchObject({
      state: "observed",
      value: "repeated_boilerplate"
    });
  });
});

describe("conservative top-card image extraction", () => {
  it("does not treat the first generic image or company logo as a profile photo", () => {
    document.body.innerHTML = `
      <main>
        <section data-pe-top-card>
          <h1>Visible Example</h1>
          <img src="company-logo.png" alt="Example Company logo">
        </section>
      </main>`;

    expect(
      extractTopCardFacts(document, getExtractionDictionary("en"), NOW).imageKind
    ).toMatchObject({ state: "unavailable" });
  });

  it("still accepts an explicitly identified profile image", () => {
    document.body.innerHTML = `
      <main>
        <section data-pe-top-card>
          <h1>Visible Example</h1>
          <img src="company-logo.png" alt="Example Company logo">
          <img data-field="profile-photo" src="synthetic-person.png" alt="Synthetic profile portrait">
        </section>
      </main>`;

    expect(
      extractTopCardFacts(document, getExtractionDictionary("en"), NOW).imageKind
    ).toMatchObject({ state: "observed", value: "personal" });
  });
});
