import { beforeEach, describe, expect, it } from "vitest";
import { findCurrentCompanyMatch, findTopCardScope } from "../../src/extractors/current-company";
import { getExtractionDictionary } from "../../src/locales/extraction";
import { extractTopCardFacts, findProfileNameAnchor } from "../../src/extractors/top-card";

const NOW = new Date("2026-07-16T12:00:00Z");

beforeEach(() => {
  document.documentElement.lang = "en";
  document.body.replaceChildren();
});

describe("current-company top-card locator", () => {
  it("chooses the company affiliation in LinkedIn's live semantic order", () => {
    document.body.innerHTML = `
      <main>
        <section role="region" aria-label="Profile primary content">
          <button id="cover"><figure></figure></button>
          <button id="photo"><figure><p>Profile photo</p></figure></button>
          <a href="#edit-background">Edit background image</a>
          <a href="/in/ada/"><h2>Ada Example</h2></a>
          <p>Senior Software Engineer</p>
          <p>Lisbon, Portugal</p>
          <button id="company"><figure><img alt="Midfy logo"></figure><p>Midfy</p></button>
          <button id="education"><figure><img alt="IFRS logo"></figure><p>IFRS</p></button>
          <span>500+ connections</span>
          <button id="message">Message</button>
        </section>
        <section>
          <h2>About</h2>
          <button id="later-company"><figure></figure><p>Unrelated later card</p></button>
        </section>
      </main>`;

    const name = findProfileNameAnchor(document)?.element;
    const scope = findTopCardScope(document, name);
    const match = findCurrentCompanyMatch(scope, name);

    expect(match?.element).toBe(document.querySelector("#company"));
    expect(match?.element).not.toBe(document.querySelector("#photo"));
    expect(match?.element).not.toBe(document.querySelector("#education"));
    expect(extractTopCardFacts(document, getExtractionDictionary("en"), NOW).currentCompany)
      .toMatchObject({ state: "observed", value: "Midfy" });
  });

  it("retains the synthetic company/education simple-button pair", () => {
    document.body.innerHTML = `
      <main><section data-pe-top-card>
        <a href="/in/ada/"><h2>Ada Example</h2></a>
        <button aria-label="View Ada's verifications">Badge</button>
        <button id="company">Midfy</button>
        <button id="education">IFRS</button>
        <button>Message</button>
      </section></main>`;

    const name = findProfileNameAnchor(document)?.element;
    const match = findCurrentCompanyMatch(findTopCardScope(document, name), name);

    expect(match?.element).toBe(document.querySelector("#company"));
  });

  it("does not guess that a lone custom action is a company", () => {
    document.body.innerHTML = `
      <main><section data-pe-top-card>
        <a href="/in/ada/"><h2>Ada Example</h2></a>
        <button>View portfolio</button>
      </section></main>`;

    const name = findProfileNameAnchor(document)?.element;
    expect(findCurrentCompanyMatch(findTopCardScope(document, name), name)).toBeUndefined();
  });
});
