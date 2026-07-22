import { beforeEach, describe, expect, it } from "vitest";
import {
  createNativeAboutMemberInspector,
  findNativeVerificationControl,
  findTransientCurrentEmployer,
  NATIVE_INSPECTION_ATTRIBUTE,
  NATIVE_INSPECTION_VALUE,
} from "../../src/content/native-about-member-inspector";

interface LocaleFixture {
  lang: string;
  controlLabel: string;
  dialogLabel: string;
  method: string;
  methodText: string;
  close: string;
}

const locales: LocaleFixture[] = [
  {
    lang: "en",
    controlLabel: "View Ada's verifications",
    dialogLabel: "About this member",
    method: "government-id",
    methodText: "Government ID verified 11 months ago",
    close: "Done",
  },
  {
    lang: "pt-BR",
    controlLabel: "Ver as verificações de Ada",
    dialogLabel: "Sobre este membro",
    method: "work-email",
    methodText: "E-mail profissional Midfy verificado há 1 ano",
    close: "Fechar",
  },
  {
    lang: "es",
    controlLabel: "Ver las verificaciones de Ada",
    dialogLabel: "Acerca de este miembro",
    method: "education",
    methodText: "Verificación educativa completada hace 8 meses",
    close: "Cerrar",
  },
];

function mountProfile(fixture: LocaleFixture): HTMLButtonElement {
  document.documentElement.lang = fixture.lang;
  document.body.innerHTML = `
    <main>
      <section data-pe-top-card>
        <div class="name-row">
          <a href="/in/ada/"><h2>Ada Example</h2></a>
          <button id="verification" aria-label="${fixture.controlLabel}">Badge</button>
        </div>
        <a href="/company/midfy/">Midfy</a>
      </section>
    </main>`;
  const control = document.querySelector<HTMLButtonElement>("#verification")!;
  control.addEventListener("click", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", fixture.dialogLabel);
    dialog.setAttribute("data-complete", "true");
    dialog.innerHTML = `
      <ul><li data-pe-verification-method="${fixture.method}">${fixture.methodText}</li></ul>
      <button id="native-close">${fixture.close}</button>`;
    dialog.querySelector("#native-close")?.addEventListener("click", () => dialog.remove());
    document.body.append(dialog);
  });
  return control;
}

describe("native About-this-member inspector", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.documentElement.lang = "en";
  });

  it.each(locales)("opens, parses, and closes the $lang native dialog", async (fixture) => {
    const control = mountProfile(fixture);
    let clicks = 0;
    control.addEventListener("click", () => { clicks += 1; });
    const inspector = createNativeAboutMemberInspector({
      settle: async ({ root }) => {
        expect(root.getAttribute("role")).toBe("dialog");
        expect(root.getAttribute(NATIVE_INSPECTION_ATTRIBUTE)).toBe(
          NATIVE_INSPECTION_VALUE
        );
        return { timedOut: false, mutationCount: 0 };
      },
      now: () => new Date("2026-07-16T00:00:00Z"),
    });
    expect(clicks).toBe(0);

    const result = await inspector({ document, signal: new AbortController().signal });

    expect(clicks).toBe(1);
    expect(result.status).toBe("inspected");
    expect(document.querySelector("[role='dialog']")).toBeNull();
    if (result.status !== "inspected") throw new Error("Expected inspected evidence");
    const verification = result.evidence?.workplaceEducationVerification;
    expect(verification?.state).toBe("observed");
    if (verification?.state !== "observed") throw new Error("Expected observed verification");
    if (fixture.method === "government-id") expect(verification.value.governmentId).toBe(true);
    if (fixture.method === "work-email") {
      expect(verification.value.workplace).toBe(true);
      expect(verification.value.workplaceMatch).toBe("current");
    }
    if (fixture.method === "education") expect(verification.value.education).toBe(true);
  });

  it("matches live figure-and-paragraph company buttons as the current employer", async () => {
    document.body.innerHTML = `
      <main><section role="region" aria-label="Profile primary content">
        <button><figure></figure></button>
        <button><figure><p>Profile photo</p></figure></button>
        <a href="/in/ada/"><h2>Ada Example</h2></a>
        <button id="verification" aria-label="View Ada's verifications">Badge</button>
        <p>Senior Software Engineer</p>
        <button id="company"><figure></figure><p>Midfy</p></button>
        <button id="education"><figure></figure><p>IFRS</p></button>
        <button>Message</button>
      </section></main>`;
    document.querySelector("#verification")?.addEventListener("click", () => {
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("data-complete", "true");
      dialog.innerHTML = `
        <ul><li data-pe-verification-method="work-email">Work email verified at Midfy one year ago</li></ul>
        <button>Done</button>`;
      dialog.querySelector("button")?.addEventListener("click", () => dialog.remove());
      document.body.append(dialog);
    });

    expect(findTransientCurrentEmployer(document)).toBe("Midfy");
    const inspector = createNativeAboutMemberInspector({
      settle: async () => ({ timedOut: false, mutationCount: 0 }),
    });
    const result = await inspector({ document, signal: new AbortController().signal });

    expect(result).toMatchObject({
      status: "inspected",
      evidence: {
        workplaceEducationVerification: {
          state: "observed",
          value: { workplace: true, workplaceMatch: "current" },
        },
      },
    });
    expect(document.querySelector("[role='dialog']")).toBeNull();
  });

  it("returns not-present without clicking when the name row has no verification control", async () => {
    document.body.innerHTML = "<main><h1>Ada Example</h1></main>";
    const inspector = createNativeAboutMemberInspector();
    await expect(inspector({ document, signal: new AbortController().signal }))
      .resolves.toEqual({ status: "not-present" });
  });

  it("activates a badge target nested in the ordinary profile-name link", async () => {
    document.body.innerHTML = `
      <main><section data-pe-top-card>
        <a href="/in/ada/"><span><h2>Ada Example</h2></span>
          <svg id="badge" role="img" aria-label="View Ada's verifications"></svg>
        </a>
      </section></main>`;
    let badgeClicks = 0;
    document.querySelector("#badge")?.addEventListener("click", (event) => {
      event.preventDefault();
      badgeClicks += 1;
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("data-complete", "true");
      dialog.innerHTML = `
        <ul><li data-pe-verification-method="government-id">Government ID verified</li></ul>
        <button>Close</button>`;
      dialog.querySelector("button")?.addEventListener("click", () => dialog.remove());
      document.body.append(dialog);
    });
    const inspector = createNativeAboutMemberInspector({
      settle: async () => ({ timedOut: false, mutationCount: 0 }),
    });

    await expect(inspector({ document, signal: new AbortController().signal }))
      .resolves.toMatchObject({ status: "inspected" });
    expect(badgeClicks).toBe(1);
  });

  it("activates one localized SVG descriptor in LinkedIn's plain verification wrapper", async () => {
    document.body.innerHTML = `
      <main><section data-pe-top-card>
        <div class="name-row">
          <h1>Ada Example</h1>
          <div id="trigger" componentkey="ProfileVerificationTriggerRef-ada">
            <svg id="badge" role="img" aria-label="View Ada's verifications"></svg>
          </div>
        </div>
      </section></main>`;
    let triggerClicks = 0;
    document.querySelector("#trigger")?.addEventListener("click", () => {
      triggerClicks += 1;
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("data-complete", "true");
      dialog.innerHTML = `
        <ul><li data-pe-verification-method="government-id">Government ID verified</li></ul>
        <button>Close</button>`;
      dialog.querySelector("button")?.addEventListener("click", () => dialog.remove());
      document.body.append(dialog);
    });
    const lookup = findNativeVerificationControl(document);
    expect(lookup).toMatchObject({ kind: "found" });
    expect(lookup.control).toBe(document.querySelector("#badge"));

    const inspector = createNativeAboutMemberInspector({
      settle: async () => ({ timedOut: false, mutationCount: 0 }),
    });
    await expect(inspector({ document, signal: new AbortController().signal }))
      .resolves.toMatchObject({ status: "inspected" });
    expect(triggerClicks).toBe(1);
  });

  it.each([
    "Verified profile",
    "Verification badge",
    "View verification badge",
    "Identity verified",
  ])("does not activate a generic SVG badge labelled %s", async (label) => {
    document.body.innerHTML = `
      <main><section data-pe-top-card>
        <div class="name-row">
          <h1>Ada Example</h1>
          <div id="trigger" componentkey="ProfileVerificationTriggerRef-ada">
            <svg role="img" aria-label="${label}"></svg>
          </div>
        </div>
      </section></main>`;
    let clicks = 0;
    document.querySelector("#trigger")?.addEventListener("click", () => { clicks += 1; });

    expect(findNativeVerificationControl(document)).toEqual({ kind: "not-present" });
    const inspector = createNativeAboutMemberInspector();
    await expect(inspector({ document, signal: new AbortController().signal }))
      .resolves.toEqual({ status: "not-present" });
    expect(clicks).toBe(0);
  });

  it("rejects multiple localized standalone SVG descriptors as ambiguous", async () => {
    document.body.innerHTML = `
      <main><section data-pe-top-card>
        <div class="name-row"><h1>Ada Example</h1>
          <div componentkey="ProfileVerificationTriggerRef-one">
            <svg role="img" aria-label="View Ada's verifications"></svg>
          </div>
          <div componentkey="ProfileVerificationTriggerRef-two">
            <svg role="img" aria-label="View profile verifications"></svg>
          </div>
        </div>
      </section></main>`;
    let clicks = 0;
    document.querySelectorAll("[componentkey]").forEach((element) => {
      element.addEventListener("click", () => { clicks += 1; });
    });

    expect(findNativeVerificationControl(document)).toEqual({ kind: "ambiguous" });
    const inspector = createNativeAboutMemberInspector();
    await expect(inspector({ document, signal: new AbortController().signal }))
      .resolves.toEqual({ status: "unreadable" });
    expect(clicks).toBe(0);
  });

  it("rejects an ambiguous name row instead of clicking either control", async () => {
    document.body.innerHTML = `
      <main><div><h1>Ada Example</h1>
        <button aria-label="View Ada's verifications">One</button>
        <button aria-label="View profile verifications">Two</button>
      </div></main>`;
    expect(findNativeVerificationControl(document).kind).toBe("ambiguous");
    const inspector = createNativeAboutMemberInspector();
    await expect(inspector({ document, signal: new AbortController().signal }))
      .resolves.toEqual({ status: "unreadable" });
  });

  it("waits for progress to settle before parsing", async () => {
    const fixture = locales[0]!;
    document.documentElement.lang = fixture.lang;
    document.body.innerHTML = `
      <main><div><h1>Ada Example</h1>
        <button id="verification" aria-label="${fixture.controlLabel}">Badge</button>
      </div></main>`;
    document.querySelector("#verification")?.addEventListener("click", () => {
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("data-complete", "true");
      dialog.innerHTML = `<div role="progressbar"></div><button>Close</button>`;
      dialog.querySelector("button")?.addEventListener("click", () => dialog.remove());
      document.body.append(dialog);
    });
    const inspector = createNativeAboutMemberInspector({
      settle: async ({ root }) => {
        expect(root.querySelector("[role='progressbar']")).not.toBeNull();
        root.querySelector("[role='progressbar']")?.remove();
        root.insertAdjacentHTML(
          "afterbegin",
          `<ul><li data-pe-verification-method="government-id">Government ID verified</li></ul>`,
        );
        return { timedOut: false, mutationCount: 2 };
      },
    });

    await expect(inspector({ document, signal: new AbortController().signal }))
      .resolves.toMatchObject({ status: "inspected" });
  });

  it("does not fail a quiet static spinner before it disappears", async () => {
    const fixture = locales[0]!;
    document.documentElement.lang = fixture.lang;
    document.body.innerHTML = `
      <main><div><h1>Ada Example</h1>
        <button id="verification" aria-label="${fixture.controlLabel}">Badge</button>
      </div></main>`;
    let closedBeforeReady = false;
    document.querySelector("#verification")?.addEventListener("click", () => {
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("data-complete", "true");
      dialog.innerHTML = `<div role="progressbar"></div><button>Close</button>`;
      dialog.querySelector("button")?.addEventListener("click", () => {
        closedBeforeReady = dialog.querySelector("[role='progressbar']") !== null;
        dialog.remove();
      });
      document.body.append(dialog);
      globalThis.setTimeout(() => {
        dialog.querySelector("[role='progressbar']")?.remove();
        dialog.insertAdjacentHTML(
          "afterbegin",
          `<ul><li data-pe-verification-method="government-id">Government ID verified</li></ul>`,
        );
      }, 400);
    });
    const inspector = createNativeAboutMemberInspector();

    await expect(inspector({ document, signal: new AbortController().signal }))
      .resolves.toMatchObject({ status: "inspected" });
    expect(closedBeforeReady).toBe(false);
    expect(document.querySelector("[role='dialog']")).toBeNull();
  });

  it("closes a still-loading dialog when its readiness bound expires", async () => {
    const fixture = locales[0]!;
    document.documentElement.lang = fixture.lang;
    document.body.innerHTML = `
      <main><div><h1>Ada Example</h1>
        <button id="verification" aria-label="${fixture.controlLabel}">Badge</button>
      </div></main>`;
    document.querySelector("#verification")?.addEventListener("click", () => {
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.innerHTML = `<div role="progressbar"></div><button>Dismiss</button>`;
      dialog.querySelector("button")?.addEventListener("click", () => dialog.remove());
      document.body.append(dialog);
    });
    const inspector = createNativeAboutMemberInspector({ dialogReadyTimeoutMs: 80 });

    await expect(inspector({ document, signal: new AbortController().signal }))
      .resolves.toEqual({ status: "unreadable" });
    expect(document.querySelector("[role='dialog']")).toBeNull();
  });

  it("uses the native dialog close fallback when no localized control exists", async () => {
    const fixture = locales[0]!;
    document.documentElement.lang = fixture.lang;
    document.body.innerHTML = `
      <main><div><h1>Ada Example</h1>
        <button id="verification" aria-label="${fixture.controlLabel}">Badge</button>
      </div></main>`;
    let nativeCloseCalls = 0;
    document.querySelector("#verification")?.addEventListener("click", () => {
      const dialog = document.createElement("dialog");
      dialog.setAttribute("open", "");
      dialog.innerHTML = `<p>Unrecognized member content</p>`;
      Object.defineProperty(dialog, "close", {
        configurable: true,
        value: () => {
          nativeCloseCalls += 1;
          dialog.removeAttribute("open");
        },
      });
      document.body.append(dialog);
    });
    const inspector = createNativeAboutMemberInspector({
      settle: async () => ({ timedOut: true, mutationCount: 0 }),
    });

    await expect(inspector({ document, signal: new AbortController().signal }))
      .resolves.toEqual({ status: "unreadable" });
    expect(nativeCloseCalls).toBe(1);
    expect(document.querySelector("dialog")?.hasAttribute("open")).toBe(false);
  });

  it("aborts while waiting for a dialog that never opens", async () => {
    document.body.innerHTML = `
      <main><div><h1>Ada Example</h1>
        <button aria-label="View Ada's verifications">Badge</button>
      </div></main>`;
    const controller = new AbortController();
    const inspector = createNativeAboutMemberInspector({ dialogTimeoutMs: 60_000 });
    const inspection = inspector({ document, signal: controller.signal });
    controller.abort();
    await expect(inspection).rejects.toMatchObject({ name: "AbortError" });
  });

  it("best-effort closes a dialog already opened when the scan is cancelled", async () => {
    mountProfile(locales[0]!);
    const controller = new AbortController();
    const inspector = createNativeAboutMemberInspector({
      settle: ({ signal }) => new Promise((_, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("cancelled", "AbortError")),
          { once: true },
        );
      }),
    });
    const inspection = inspector({ document, signal: controller.signal });
    await Promise.resolve();
    expect(document.querySelector("[role='dialog']")).not.toBeNull();
    controller.abort();

    await expect(inspection).rejects.toMatchObject({ name: "AbortError" });
    expect(document.querySelector("[role='dialog']")).toBeNull();
  });
});
