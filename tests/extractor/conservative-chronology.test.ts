import { describe, expect, it } from "vitest";
import { extractProfileEvidence } from "../../src/extractors/profile-extractor";

const PROFILE_URL = "https://www.linkedin.com/in/synthetic-conservative/";
const NOW = new Date("2026-07-16T12:00:00Z");

function extract(html: string) {
  document.documentElement.lang = "en";
  document.body.innerHTML = html;
  return extractProfileEvidence(document, { url: PROFILE_URL, now: NOW });
}

describe("conservative chronology and consistency", () => {
  it("does not call a single visible dated role a consistent chronology", () => {
    const evidence = extract(`
      <main>
        <section data-pe-top-card><h1>One Role</h1><p data-pe-field="headline">Software Engineer</p></section>
        <section data-pe-section="experience">
          <article data-pe-item>
            <h3 data-pe-field="title">Software Engineer</h3>
            <a data-pe-field="employer" href="https://www.linkedin.com/company/example/">Example</a>
            <time data-pe-field="dates">January 2024 - Present</time>
            <p data-pe-field="description">Built an internal platform with measurable delivery outcomes.</p>
          </article>
        </section>
      </main>`);

    expect(evidence.workHistoryDetail.state).toBe("observed");
    expect(evidence.careerChronology.state).toBe("unavailable");
  });

  it("does not call one aligned pair strong when another visible section is unrelated", () => {
    const evidence = extract(`
      <main>
        <section data-pe-top-card>
          <h1>Mixed Sections</h1>
          <p data-pe-field="headline">TypeScript platform engineer for cloud systems</p>
        </section>
        <section data-pe-section="about"><h2>About</h2><p>TypeScript platform engineer for cloud systems and APIs.</p></section>
        <section data-pe-section="skills"><h2>Skills</h2><ul><li data-pe-item>Oil painting</li><li data-pe-item>Watercolors</li><li data-pe-item>Sculpture</li></ul></section>
      </main>`);

    expect(evidence.crossSectionConsistency).not.toMatchObject({
      state: "observed",
      value: "strong_alignment"
    });
  });
});
