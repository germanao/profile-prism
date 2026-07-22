import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  elementText,
  isElementRendered,
  meaningfulSectionText,
  queryRendered,
  withDomReadSession,
} from "../../src/extractors/dom";

describe("rendered-DOM boundary", () => {
  beforeEach(() => {
    document.head.innerHTML = `<style>.css-hidden { display: none; } .collapsed { visibility: collapse; } .transparent { opacity: 0; }</style>`;
    document.body.innerHTML = "";
  });

  it("excludes content hidden by computed stylesheet rules", () => {
    document.body.innerHTML = `
      <section id="visible">Visible text <span class="css-hidden">hidden experiment text</span></section>
      <section class="css-hidden" id="hidden">hidden section</section>
      <section class="collapsed" id="collapsed">collapsed section</section>
      <section class="transparent" id="transparent">transparent section</section>`;

    const visible = document.querySelector("#visible")!;
    expect(elementText(visible)).toBe("Visible text");
    expect(isElementRendered(document.querySelector("#hidden")!)).toBe(false);
    expect(isElementRendered(document.querySelector("#collapsed")!)).toBe(false);
    expect(isElementRendered(document.querySelector("#transparent")!)).toBe(false);
    expect(queryRendered(document, "section")).toHaveLength(1);
  });

  it("reads a closed details summary but not its collapsed branch", () => {
    document.body.innerHTML = `
      <details>
        <summary id="summary">Visible summary</summary>
        <div id="branch">Collapsed private branch</div>
      </details>
      <dialog id="dialog">Closed dialog content</dialog>`;

    expect(isElementRendered(document.querySelector("#summary")!)).toBe(true);
    expect(elementText(document.querySelector("#summary")!)).toBe("Visible summary");
    expect(isElementRendered(document.querySelector("#branch")!)).toBe(false);
    expect(isElementRendered(document.querySelector("#dialog")!)).toBe(false);
  });

  it("keeps meaningful section text tied to original computed visibility", () => {
    document.body.innerHTML = `
      <section id="section">
        <h2>About</h2>
        <p>Rendered profile content</p>
        <p class="css-hidden">Hidden duplicate content</p>
        <button>Show more</button>
      </section>`;

    expect(meaningfulSectionText(document.querySelector("#section")!)).toBe("Rendered profile content");
  });

  it("reads visually rendered aria-hidden copy while excluding screen-reader-only duplicates", () => {
    document.body.innerHTML = `
      <h2>
        <span aria-hidden="true">Experience</span>
        <span class="visually-hidden">Experience</span>
      </h2>`;

    expect(elementText(document.querySelector("h2")!)).toBe("Experience");
    expect(isElementRendered(document.querySelector("[aria-hidden='true']")!)).toBe(true);
    expect(isElementRendered(document.querySelector(".visually-hidden")!)).toBe(false);
  });

  it("reuses visibility, text, and query work within one extraction session", () => {
    document.body.innerHTML = `
      <main><section><span id="value">Visible profile value</span></section></main>`;
    const span = document.querySelector<HTMLElement>("#value")!;
    const styleSpy = vi.spyOn(globalThis, "getComputedStyle");

    withDomReadSession(() => {
      expect(isElementRendered(span)).toBe(true);
      const firstPassCalls = styleSpy.mock.calls.length;
      expect(firstPassCalls).toBeGreaterThan(0);

      expect(isElementRendered(span)).toBe(true);
      expect(elementText(span)).toBe("Visible profile value");
      expect(elementText(span)).toBe("Visible profile value");
      expect(queryRendered(document, "#value")).toEqual([span]);
      expect(queryRendered(document, "#value")).toEqual([span]);

      expect(styleSpy).toHaveBeenCalledTimes(firstPassCalls);
    });
  });
});
