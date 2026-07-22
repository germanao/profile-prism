import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findProfileContentRoot,
  findProfileScrollSurface,
  hasVisibleBusyIndicator,
  isAtSurfaceBottom,
} from "../../src/content/scroll-surface";

function dimensions(
  element: HTMLElement,
  values: { clientHeight: number; scrollHeight: number; scrollTop?: number },
): void {
  let top = values.scrollTop ?? 0;
  Object.defineProperties(element, {
    clientHeight: { configurable: true, get: () => values.clientHeight },
    scrollHeight: { configurable: true, get: () => values.scrollHeight },
    scrollTop: {
      configurable: true,
      get: () => top,
      set: (value: number) => { top = value; },
    },
  });
}

describe("profile scroll-surface discovery", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("selects the profile main scroller and excludes messaging/sidebar mains", () => {
    document.body.innerHTML = `
      <aside aria-label="Messaging">
        <main id="chat"><h2>Messages</h2></main>
      </aside>
      <div id="shell" style="overflow-y: auto">
        <main id="profile">
          <h1>Example Person</h1>
          <a href="https://www.linkedin.com/in/example/">Profile</a>
          <section>Experience</section>
        </main>
      </div>`;
    const chat = document.querySelector<HTMLElement>("#chat")!;
    const shell = document.querySelector<HTMLElement>("#shell")!;
    dimensions(chat, { clientHeight: 200, scrollHeight: 2_000 });
    chat.style.overflowY = "auto";
    dimensions(shell, { clientHeight: 500, scrollHeight: 1_800 });

    expect(findProfileContentRoot(document)?.id).toBe("profile");
    const surface = findProfileScrollSurface(document);
    expect(surface?.kind).toBe("element");
    expect(surface?.element).toBe(shell);
    expect(surface?.contentRoot.id).toBe("profile");
  });

  it("falls back to the document scroller and clamps positions at the bottom", () => {
    document.body.innerHTML = "<main><h1>Example Person</h1></main>";
    const root = document.documentElement;
    dimensions(root, { clientHeight: 500, scrollHeight: 1_200 });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    const surface = findProfileScrollSurface(document)!;
    expect(surface.kind).toBe("document");
    surface.setTop(10_000);
    expect(surface.metrics().top).toBe(700);
    expect(isAtSurfaceBottom(surface)).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 700, left: 0, behavior: "auto" });
    scrollTo.mockRestore();
  });

  it("reports only rendered busy indicators within the profile root", () => {
    document.body.innerHTML = `
      <main><div id="hidden" role="progressbar" hidden></div></main>
      <aside><div role="progressbar"></div></aside>`;
    const surface = findProfileScrollSurface(document)!;
    expect(hasVisibleBusyIndicator(surface)).toBe(false);
    document.querySelector("#hidden")?.removeAttribute("hidden");
    expect(hasVisibleBusyIndicator(surface)).toBe(true);
  });
});
