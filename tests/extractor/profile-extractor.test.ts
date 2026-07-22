import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractProfileEvidence,
  findProfileNameAnchor,
  isSupportedLinkedInProfileUrl,
} from "../../src/extractors/profile-extractor";
import { evaluateProfileEvidence } from "../../src/scoring/evaluate";

const NOW = new Date("2026-07-16T12:00:00Z");
const PROFILE_URL = "https://www.linkedin.com/in/synthetic-profile/";

function loadFixture(locale: "en" | "pt" | "es", filename: string): void {
  const html = readFileSync(join(process.cwd(), "fixtures", locale, filename), "utf8");
  document.open();
  document.write(html);
  document.close();
}

function extract() {
  return extractProfileEvidence(document, { url: PROFILE_URL, now: NOW });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("visible profile extractor", () => {
  it("extracts a complete English recruiter profile", () => {
    loadFixture("en", "recruiter-complete.html");
    const evidence = extract();

    expect(evidence.identityVerification).toMatchObject({ state: "absent" });
    expect(evidence.workplaceEducationVerification).toMatchObject({
      state: "observed",
      value: { governmentId: true, workplace: true, education: false },
    });
    expect(evidence.accountAge.state).toBe("observed");
    expect(evidence.workHistoryDetail).toMatchObject({ state: "observed", value: "several_substantive_dated_roles" });
    expect(evidence.careerChronology).toMatchObject({ state: "observed", value: "rich_coherent" });
    expect(evidence.companyAffiliation).toMatchObject({ state: "observed", value: "linked_employer_specific_role" });
    expect(evidence.coreCompleteness).toMatchObject({ state: "observed", value: "several_substantive_sections" });
    expect(evidence.activityDistribution).toMatchObject({ state: "observed", value: "distributed_over_years" });
    expect(evidence.networkMaturity).toMatchObject({ state: "observed", value: "plausible" });
    expect(evidence.recommendations).toMatchObject({ state: "observed", value: "several_specific_across_people_and_time" });
    expect(evidence.contentSpecificity).toMatchObject({ state: "observed", value: "concrete_technologies_projects_or_outcomes" });
    expect(evidence.profileImage).toMatchObject({
      state: "observed",
      value: { kind: "personal", isNewProfile: false, isBroadlyThin: false },
    });
    expect(findProfileNameAnchor(document)?.element.textContent).toContain("Jordan Example");
  });

  it("extracts equivalent structural evidence from Portuguese", () => {
    loadFixture("pt", "engineer-complete.html");
    const evidence = extract();

    expect(evidence.identityVerification.state).toBe("absent");
    expect(evidence.workplaceEducationVerification).toMatchObject({
      state: "observed",
      value: { governmentId: true, education: true },
    });
    expect(evidence.workHistoryDetail).toMatchObject({ state: "observed", value: "several_substantive_dated_roles" });
    expect(evidence.careerChronology).toMatchObject({ state: "observed", value: "rich_coherent" });
    expect(evidence.companyAffiliation).toMatchObject({ state: "observed", value: "linked_employer_specific_role" });
    expect(evidence.contentSpecificity).toMatchObject({ state: "observed", value: "concrete_technologies_projects_or_outcomes" });
  });

  it("uses accessible labels and heading relationships when data markers are absent", () => {
    loadFixture("en", "semantic-reordered.html");
    const evidence = extract();

    expect(evidence.workHistoryDetail).toMatchObject({ state: "observed", value: "adequate" });
    expect(evidence.careerChronology).toMatchObject({ state: "observed", value: "consistent" });
    expect(evidence.companyAffiliation).toMatchObject({ state: "observed", value: "linked_employer_specific_role" });
    expect(evidence.coreCompleteness).toMatchObject({ state: "observed", value: "several_substantive_sections" });
  });

  it("extracts the current LinkedIn div-based semantic profile cards", () => {
    loadFixture("en", "current-linkedin-semantic.html");
    const evidence = extract();

    expect(findProfileNameAnchor(document)?.element).toMatchObject({ tagName: "H2" });
    expect(evidence.identityVerification).toMatchObject({ state: "observed", value: "active" });
    expect(evidence.profileImage).toMatchObject({ state: "observed", value: { kind: "personal" } });
    expect(evidence.workHistoryDetail).toMatchObject({ state: "observed", value: "several_substantive_dated_roles" });
    expect(evidence.careerChronology).toMatchObject({ state: "observed", value: "rich_coherent" });
    expect(evidence.companyAffiliation).toMatchObject({ state: "observed", value: "linked_employer_specific_role" });
    expect(evidence.activityDistribution).toMatchObject({ state: "observed", value: "at_least_six_months" });
    expect(evidence.reciprocalEngagement.state).toBe("unavailable");
    expect(evidence.recommendations.state).toBe("absent");
    expect(evidence.networkMaturity).toMatchObject({ state: "observed", value: "plausible" });

    const result = evaluateProfileEvidence(evidence);
    expect(result.score).toBe(82);
    expect(result.coveragePercent).toBe(57);
  });

  it("finds a nested div-only card body without crossing into the next card", () => {
    document.documentElement.lang = "en";
    document.body.innerHTML = `
      <main>
        <section data-pe-top-card>
          <h1>Div Card Example</h1>
          <p data-pe-field="headline">Senior Software Engineer at Example Labs</p>
          <span data-pe-field="current-company">Example Labs</span>
        </section>
        <div class="random-card-a">
          <div class="random-header-a"><h2>Experience</h2></div>
          <div class="random-body-a">
            <div><a href="/company/example-labs"><span>Principal Engineer</span><span>Example Labs</span><span>Jan 2022 - Present</span></a><p>Led a platform migration using TypeScript and PostgreSQL, reducing processing time by 45%.</p></div>
            <div><a href="/company/example-cloud"><span>Software Engineer</span><span>Example Cloud</span><span>Jan 2019 - Dec 2021</span></a><p>Built documented cloud APIs and deployment automation for enterprise customers.</p></div>
            <div><a href="/company/example-startup"><span>Junior Engineer</span><span>Example Startup</span><span>Jan 2017 - Dec 2018</span></a><p>Delivered production web features and automated regression tests across the product.</p></div>
          </div>
        </div>
        <div class="random-card-b">
          <div><h2>Education</h2></div>
          <p>Example University, Computer Science, 2013 - 2016</p>
        </div>
      </main>`;

    const evidence = extract();
    expect(evidence.workHistoryDetail).toMatchObject({
      state: "observed",
      value: "several_substantive_dated_roles"
    });
    expect(evidence.careerChronology).toMatchObject({
      state: "observed",
      value: "rich_coherent"
    });
  });

  it("keeps private or unrendered profile sections unavailable", () => {
    loadFixture("en", "private-profile.html");
    const evidence = extract();

    expect(evidence.workHistoryDetail.state).toBe("unavailable");
    expect(evidence.coreCompleteness.state).toBe("unavailable");
    expect(evidence.activityDistribution.state).toBe("unavailable");
    expect(evidence.recommendations.state).toBe("unavailable");
    expect(evidence.networkMaturity.state).toBe("unavailable");
    expect(evidence.identityVerification.state).toBe("unavailable");
  });

  it("distinguishes explicit empty sections from lazy partial DOM", () => {
    loadFixture("pt", "thin-new-recruiter.html");
    const thin = extract();
    expect(thin.workHistoryDetail).toMatchObject({ state: "observed", value: "established_empty_or_vague" });
    expect(thin.coreCompleteness).toMatchObject({ state: "observed", value: "three_or_more_confirmed_empty" });
    expect(thin.networkMaturity).toMatchObject({
      state: "observed",
      value: "under_30_established_senior_or_recruiter_with_thin_signal",
    });
    expect(thin.activityDistribution).toMatchObject({
      state: "observed",
      value: "sudden_near_duplicate_burst_with_thin_signal",
    });
    expect(thin.profileImage).toMatchObject({
      state: "observed",
      value: { kind: "default_or_non_person", isNewProfile: true, isBroadlyThin: true },
    });

    loadFixture("en", "lazy-partial.html");
    const lazy = extract();
    expect(lazy.workHistoryDetail.state).toBe("unavailable");
    expect(lazy.activityDistribution.state).toBe("unavailable");
    expect(lazy.coreCompleteness.state).toBe("unavailable");
  });

  it("detects only material, visible Spanish contradictions", () => {
    loadFixture("es", "contradictory-profile.html");
    const evidence = extract();

    expect(evidence.careerChronology).toMatchObject({ state: "observed", value: "material_contradiction" });
    expect(evidence.companyAffiliation).toMatchObject({ state: "observed", value: "material_identity_conflict" });
    expect(evidence.crossSectionConsistency).toMatchObject({ state: "observed", value: "material_conflict" });
  });

  it("does not turn an ordinary current-company mismatch into two cautions", () => {
    loadFixture("es", "contradictory-profile.html");
    document.querySelector("[data-pe-section='experience']")?.removeAttribute("data-pe-company-conflict");
    const evidence = extract();

    expect(evidence.companyAffiliation).toMatchObject({ state: "observed", value: "neutral" });
    expect(evidence.crossSectionConsistency).not.toMatchObject({ state: "observed", value: "material_conflict" });
  });

  it("does not count one About passage twice as generic repetition", () => {
    document.documentElement.lang = "en";
    document.body.innerHTML = `
      <main>
        <section data-pe-top-card><h1>Generic Example</h1><p data-pe-field="headline">Independent professional</p></section>
        <section data-pe-section="about"><h2>About</h2><p>Results-driven professional seeking new opportunities.</p></section>
      </main>`;

    expect(extract().contentSpecificity).toMatchObject({ state: "observed", value: "neutral" });
  });

  it("leaves activity distribution unavailable when visible dates cannot be parsed", () => {
    document.documentElement.lang = "en";
    document.body.innerHTML = `
      <main>
        <section data-pe-top-card><h1>Undated Activity</h1><p data-pe-field="headline">Software Engineer</p></section>
        <section data-pe-section="activity"><h2>Activity</h2>
          <article data-pe-item><time data-pe-field="date">Recently</time><p data-pe-field="content">A visible post without a usable date.</p></article>
          <article data-pe-item><time data-pe-field="date">Some time ago</time><p data-pe-field="content">Another visible post without a usable date.</p></article>
        </section>
      </main>`;

    expect(extract().activityDistribution.state).toBe("unavailable");
  });

  it("never substitutes a low follower count for missing connections when assigning caution", () => {
    loadFixture("pt", "thin-new-recruiter.html");
    document.querySelector("[data-pe-field='connections']")?.remove();
    const followers = document.createElement("span");
    followers.dataset.peField = "followers";
    followers.textContent = "12 seguidores";
    document.querySelector("[data-pe-top-card]")?.append(followers);

    expect(extract().networkMaturity).toMatchObject({ state: "observed", value: "neutral" });
  });

  it("requires explicit visible reciprocal semantics for engagement evidence", () => {
    document.documentElement.lang = "en";
    document.body.innerHTML = `
      <main>
        <section data-pe-top-card><h1>Engagement Example</h1><p data-pe-field="headline">Software Engineer</p></section>
        <section data-pe-section="activity"><h2>Activity</h2>
          <article data-pe-item><time data-pe-field="date">2 days ago</time><p data-pe-field="content">First post</p><p data-pe-kind="comment">Generic visible comment</p></article>
          <article data-pe-item><time data-pe-field="date">8 months ago</time><p data-pe-field="content">Second post</p><p data-pe-kind="reply">Generic visible reply</p></article>
        </section>
      </main>`;
    expect(extract().reciprocalEngagement.state).toBe("unavailable");

    document.querySelectorAll("[data-pe-kind]").forEach((element) => {
      element.setAttribute("data-pe-engagement", "reciprocal");
    });
    expect(extract().reciprocalEngagement).toMatchObject({ state: "observed", value: "some_genuine_exchange" });
  });

  it("parses compact activity dates inside semantic list cards", () => {
    document.documentElement.lang = "en";
    document.body.innerHTML = `
      <main>
        <section data-pe-top-card><h1>Activity Example</h1><p data-pe-field="headline">Software Engineer</p></section>
        <section data-pe-section="activity"><h2>Activity</h2><ul>
          <li><span>1mo</span><p>Published a detailed platform migration retrospective.</p></li>
          <li><span>11mo</span><p>Shared a production reliability case study.</p></li>
        </ul></section>
      </main>`;

    expect(extract().activityDistribution).toMatchObject({
      state: "observed",
      value: "at_least_six_months"
    });

    document.querySelector("li:last-child")?.remove();
    expect(extract().activityDistribution.state).toBe("unavailable");
  });

  it("keeps a non-empty Experience skeleton unavailable when no role can be parsed", () => {
    document.documentElement.lang = "en";
    document.body.innerHTML = `
      <main>
        <section data-pe-top-card><h1>Partial Example</h1><p data-pe-field="headline">Senior Engineer</p></section>
        <section data-pe-section="experience" aria-busy="true"><h2>Experience</h2>
          <p>Loading the member's professional history. Please wait while this section becomes available.</p>
        </section>
      </main>`;

    expect(extract().workHistoryDetail.state).toBe("unavailable");
    expect(extract().careerChronology.state).toBe("unavailable");
  });

  it("keeps a future member-since date unavailable", () => {
    document.documentElement.lang = "en";
    document.body.innerHTML = `
      <main><section data-pe-top-card><h1>Future Date Example</h1>
        <p data-pe-field="headline">Software Engineer</p>
        <p data-pe-field="member-since">Member since December 2026</p>
      </section></main>`;

    expect(extract().accountAge.state).toBe("unavailable");
  });

  it("does not treat student status, no photo, or private sections as caution facts", () => {
    loadFixture("es", "private-student.html");
    const evidence = extract();

    expect(evidence.workHistoryDetail.state).toBe("unavailable");
    expect(evidence.coreCompleteness.state).toBe("unavailable");
    expect(evidence.profileImage).toMatchObject({
      state: "observed",
      value: { kind: "none", isNewProfile: false, isBroadlyThin: false },
    });
  });

  it("can be rerun when the page itself lazy-loads a section", () => {
    loadFixture("en", "lazy-partial.html");
    expect(extract().workHistoryDetail.state).toBe("unavailable");

    const section = document.querySelector<HTMLElement>("[data-pe-section='experience']")!;
    section.removeAttribute("aria-busy");
    section.querySelector("[role='status']")?.remove();
    const item = document.createElement("article");
    item.dataset.peItem = "";
    item.innerHTML = `
      <h3 data-pe-field="title">Software Engineer</h3>
      <a data-pe-field="employer" href="https://www.linkedin.com/company/example/">Example</a>
      <time data-pe-field="dates">January 2024 - Present</time>
      <p data-pe-field="description">Built a TypeScript API and reduced response time by 30%.</p>`;
    section.append(item);

    expect(extract().workHistoryDetail).toMatchObject({ state: "observed", value: "adequate" });
  });

  it("performs no click, scroll, navigation, or network operation", () => {
    loadFixture("en", "recruiter-complete.html");
    const click = vi.spyOn(HTMLElement.prototype, "click");
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    extract();

    expect(click).not.toHaveBeenCalled();
    expect(scroll).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ignores profile evidence inside hidden rendered-DOM branches", () => {
    document.documentElement.lang = "en";
    document.body.innerHTML = `
      <main>
        <section data-pe-top-card>
          <h1>Visible Example</h1>
          <p data-pe-field="headline">Software professional</p>
        </section>
        <section data-pe-section="experience" hidden>
          <article data-pe-item>
            <h3 data-pe-field="title">Chief Executive Officer</h3>
            <p data-pe-field="description">Built Kubernetes systems with a 90% measured outcome.</p>
          </article>
        </section>
        <section data-pe-section="about">
          <h2>About</h2>
          <p>General profile text <span class="visually-hidden">Kubernetes TypeScript reduced latency 90%</span></p>
        </section>
      </main>`;

    const evidence = extract();
    expect(evidence.workHistoryDetail.state).toBe("unavailable");
    expect(evidence.contentSpecificity).not.toMatchObject({
      state: "observed",
      value: "concrete_technologies_projects_or_outcomes",
    });
  });

  it("sets content specificity unavailable for an unsupported interface language", () => {
    document.documentElement.lang = "fr";
    document.body.innerHTML = `<main><section data-pe-top-card><h1>Profil synthétique</h1><p data-pe-field="headline">Ingénieur logiciel</p></section></main>`;
    expect(extract().contentSpecificity.state).toBe("unavailable");
  });
});

describe("profile route guard", () => {
  it.each([
    "https://www.linkedin.com/in/example/",
    "https://www.linkedin.com/in/example",
  ])("accepts %s", (url) => expect(isSupportedLinkedInProfileUrl(url)).toBe(true));

  it.each([
    "http://www.linkedin.com/in/example/",
    "https://linkedin.com/in/example/",
    "https://www.linkedin.com/company/example/",
    "https://example.com/in/example/",
    "not a url",
  ])("rejects %s", (url) => expect(isSupportedLinkedInProfileUrl(url)).toBe(false));
});
