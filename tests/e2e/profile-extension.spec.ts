import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const PROJECT_ROOT = process.cwd();
const PROFILE_URL = "https://www.linkedin.com/in/synthetic-profile/";

async function fixture(name: string): Promise<string> {
  return readFile(path.join(PROJECT_ROOT, "fixtures", "en", name), "utf8");
}

function buildTarget(testInfo: TestInfo): "chrome" | "firefox" {
  return testInfo.project.name === "firefox" ? "firefox" : "chrome";
}

async function installWebExtensionMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Listener = (...args: unknown[]) => unknown;
    const storageListeners = new Set<Listener>();
    const messageListeners = new Set<Listener>();
    const preferences = {
      profileAuthenticityPreferences: {
        enabled: true,
        uiLocale: "en",
        preferencesSchemaVersion: 2
      }
    };

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        storage: {
          local: {
            get(_keys: unknown, callback?: (values: unknown) => void) {
              callback?.(preferences);
            },
            set(_values: unknown, callback?: () => void) {
              callback?.();
            }
          },
          onChanged: {
            addListener(listener: Listener) {
              storageListeners.add(listener);
            },
            removeListener(listener: Listener) {
              storageListeners.delete(listener);
            }
          }
        },
        runtime: {
          getURL(resourcePath: string) {
            return resourcePath;
          },
          getManifest() {
            return { version: "0.3.0" };
          },
          onMessage: {
            addListener(listener: Listener) {
              messageListeners.add(listener);
            },
            removeListener(listener: Listener) {
              messageListeners.delete(listener);
            }
          }
        },
        i18n: {
          getMessage() {
            return "";
          },
          getUILanguage() {
            return "en";
          }
        }
      }
    });
  });
}

async function openFixture(
  page: Page,
  html: string,
  testInfo: TestInfo
): Promise<void> {
  await installWebExtensionMock(page);
  await page.route("https://www.linkedin.com/**", async (route) => {
    if (route.request().resourceType() === "document") {
      await route.fulfill({ status: 200, contentType: "text/html", body: html });
    } else {
      await route.abort();
    }
  });
  await page.goto(PROFILE_URL);
  await page.addStyleTag({
    path: path.join(PROJECT_ROOT, "dist", buildTarget(testInfo), "content.css")
  });
  await page.addScriptTag({
    path: path.join(PROJECT_ROOT, "dist", buildTarget(testInfo), "content.js")
  });
}

function badge(page: Page) {
  return page.locator(
    "[data-profile-authenticity-host='profile-evidence-badge'] button.pae-badge"
  );
}

function scanFab(page: Page) {
  return page.locator(
    "[data-profile-authenticity-fab='visible-profile-scan'] button.pae-fab"
  );
}

test("renders an explained numeric score beside a complete profile", async ({ page }, testInfo) => {
  await openFixture(page, await fixture("recruiter-complete.html"), testInfo);

  const trigger = badge(page);
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute(
    "aria-label",
    /Profile Evidence score: \d+ out of 100/
  );
  await expect(
    page.locator("[data-profile-authenticity-host='profile-evidence-badge']")
  ).toHaveCount(1);

  await trigger.hover();
  const card = page.locator(
    "[data-profile-authenticity-overlay='profile-evidence-details'] #pae-evidence-popover"
  );
  await expect(card).toBeVisible();
  await expect(card).toContainText("Initial estimate");
  await expect(card).toContainText("Evidence index—not identity verification or a fraud decision");
});

test("always shows a neutral numeric result when evidence is insufficient", async ({ page }, testInfo) => {
  await openFixture(page, await fixture("private-profile.html"), testInfo);

  const trigger = badge(page);
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("data-tone", "neutral");
  await expect(trigger.locator(".pae-value")).toHaveText(/^\d{1,3}$/);

  await trigger.focus();
  await expect(
    page.locator(
      "[data-profile-authenticity-overlay='profile-evidence-details'] #pae-evidence-popover"
    )
  ).toContainText("Insufficient visible evidence");
});

test("guides a user-triggered lazy-loading scan and returns to the top", async ({ page }, testInfo) => {
  await openFixture(page, await fixture("full-scan-lazy.html"), testInfo);

  const initialScore = Number.parseInt(await badge(page).locator(".pae-value").innerText(), 10);
  const fab = scanFab(page);
  const host = page.locator("[data-profile-authenticity-fab='visible-profile-scan']");
  await expect(fab).toBeVisible();
  await expect(fab).toContainText("Click to verify authenticity");

  await fab.click();
  const scanOverlay = page.locator(
    "[data-profile-authenticity-scan-overlay='full-profile-progress'] .pae-scan-card"
  );
  await expect(scanOverlay).toBeVisible();
  await expect(scanOverlay).toContainText("Full profile scan");
  await expect(scanOverlay).toContainText("How authentic is this profile?");
  await expect(scanOverlay).toContainText("Live estimate");
  await expect(host).toHaveAttribute("data-state", "complete", { timeout: 20_000 });
  await expect(page.locator("html")).toHaveAttribute("data-lazy-stage", "2");
  await expect(page.locator("html")).toHaveAttribute(
    "data-native-dialog-suppressed",
    "true"
  );
  await expect(page.locator("body > [role='dialog']")).toHaveCount(0);

  const finalScore = Number.parseInt(await badge(page).locator(".pae-value").innerText(), 10);
  expect(finalScore).toBeGreaterThan(initialScore);
  expect(finalScore).toBeGreaterThanOrEqual(90);
  await expect(fab).toContainText(String(finalScore));
  expect(await page.evaluate(() => document.scrollingElement!.scrollTop)).toBeLessThanOrEqual(4);
  await expect(scanOverlay).not.toBeVisible({ timeout: 4_000 });

  await fab.hover();
  const card = page.locator(
    "[data-profile-authenticity-overlay='profile-evidence-details'] .pae-card"
  );
  await expect(card).toBeVisible();
  await expect(card).toContainText("Full visible profile scanned");
});

test("replaces rather than duplicates the badge after SPA navigation", async ({ page }, testInfo) => {
  await openFixture(page, await fixture("recruiter-complete.html"), testInfo);
  await expect(badge(page)).toBeVisible();

  const privateHtml = await fixture("private-profile.html");
  await page.evaluate((html) => {
    const next = new DOMParser().parseFromString(html, "text/html");
    document.body.replaceWith(next.body);
    history.pushState({}, "", "/in/another-synthetic-profile/");
    dispatchEvent(new PopStateEvent("popstate"));
  }, privateHtml);

  await expect(badge(page)).toBeVisible();
  await expect(badge(page)).toHaveAttribute("data-tone", "neutral");
  await expect(
    page.locator("[data-profile-authenticity-host='profile-evidence-badge']")
  ).toHaveCount(1);
});

test("repairs the badge when LinkedIn removes it from the current name row", async ({ page }, testInfo) => {
  await openFixture(page, await fixture("recruiter-complete.html"), testInfo);
  const host = page.locator(
    "[data-profile-authenticity-host='profile-evidence-badge']"
  );
  await expect(host).toBeVisible();

  await host.evaluate((node) => {
    node.setAttribute("data-detached-instance", "true");
    node.remove();
  });

  await expect(host).toBeVisible();
  await expect(host).not.toHaveAttribute("data-detached-instance", "true");
  await expect(host).toHaveCount(1);
});

test("mounts beside LinkedIn's unlinked H2 profile-name variant", async ({ page }, testInfo) => {
  const source = await fixture("recruiter-complete.html");
  const unlinkedH2 = source
    .replace(
      '<h1 data-pe-field="name">Jordan Example</h1>',
      "<h2>Jordan Example</h2>"
    )
    .replace(
      "</section>",
      '<a href="/in/synthetic-profile/overlay/contact-info/">Contact info</a></section>'
    );

  await openFixture(page, unlinkedH2, testInfo);
  await expect(badge(page)).toBeVisible();
  await expect(
    page.locator("[data-profile-authenticity-host='profile-evidence-badge']")
  ).toHaveCount(1);
});

test("keeps the badge in the signaled name card instead of the About card", async ({ page }, testInfo) => {
  const currentLinkedInLayout = `<!doctype html>
    <html lang="en">
      <body>
        <main>
          <section id="top-card">
            <img alt="Marcos Esmeraldino profile photo">
            <div style="display:flex;align-items:center">
              <h2>Marcos Esmeraldino</h2><span>He/Him · 1st</span>
            </div>
            <p>Senior Software Engineer | Java Backend</p>
            <button>Contact info</button>
            <span>500+ connections</span>
            <button>Message</button>
          </section>
          <section><h2>Highlights</h2></section>
          <section id="about-card" data-view-name="profile-card">
            <div style="display:flex;justify-content:space-between">
              <h2>About</h2>
            </div>
            <p>Senior backend developer building scalable systems.</p>
          </section>
        </main>
      </body>
    </html>`;

  await openFixture(page, currentLinkedInLayout, testInfo);
  const host = page.locator(
    "[data-profile-authenticity-host='profile-evidence-badge']"
  );
  await expect(host).toBeVisible();
  await expect(host).toHaveCount(1);
  expect(await host.evaluate((node) => node.closest("section")?.id)).toBe(
    "top-card"
  );
  await expect(page.locator("#about-card").locator(
    "[data-profile-authenticity-host='profile-evidence-badge']"
  )).toHaveCount(0);
});

test("uses the full pinned popover width for expanded evidence", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFixture(page, await fixture("recruiter-complete.html"), testInfo);

  await badge(page).click();
  const card = page.locator(
    "[data-profile-authenticity-overlay='profile-evidence-details'] .pae-card"
  );
  await card.locator(".pae-disclosure").click();
  await expect(card.locator(".pae-expanded-details")).toBeVisible();

  const rightGap = await card.evaluate((node) => {
    const content = node.querySelector<HTMLElement>(".pae-card-content")!;
    return node.getBoundingClientRect().right - content.getBoundingClientRect().right;
  });
  expect(rightGap).toBeLessThanOrEqual(18);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`keeps the redesigned score surfaces stable in ${colorScheme} mode`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await openFixture(page, await fixture("recruiter-complete.html"), testInfo);

    await badge(page).hover();
    await expect(page.locator(
      "[data-profile-authenticity-overlay='profile-evidence-details'] #pae-evidence-popover"
    )).toBeVisible();
    await expect(page).toHaveScreenshot(`profile-surfaces-${colorScheme}.png`, {
      animations: "disabled"
    });
  });

  test(`renders the guided scan and success overlay in ${colorScheme} mode`, async ({
    page
  }, testInfo) => {
    await page.addInitScript(() => {
      const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
      globalThis.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) =>
        nativeSetTimeout(handler, delay === 1_200 ? 10_000 : delay, ...args)
      ) as typeof globalThis.setTimeout;
    });
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await openFixture(page, await fixture("full-scan-lazy.html"), testInfo);

    await scanFab(page).click();
    const overlay = page.locator(
      "[data-profile-authenticity-scan-overlay='full-profile-progress'] .pae-scan-card"
    );
    await expect(overlay.locator(".pae-scan-stage")).toHaveText(
      "Reading visible profile sections",
      { timeout: 5_000 }
    );
    await overlay.evaluate((element, scheme) => {
      const card = element as HTMLElement;
      card.style.backdropFilter = "none";
      card.style.setProperty("-webkit-backdrop-filter", "none");
      card.style.background = scheme === "dark" ? "#1f2630" : "#ffffff";
      const snapshot = card.cloneNode(true) as HTMLElement;
      snapshot.classList.add("pae-scan-card-snapshot");
      card.hidden = true;
      card.parentElement!.append(snapshot);
    }, colorScheme);
    const snapshotCard = page.locator(
      "[data-profile-authenticity-scan-overlay='full-profile-progress'] .pae-scan-card-snapshot"
    );
    await expect(snapshotCard).toHaveScreenshot(`scan-overlay-scanning-${colorScheme}.png`, {
      animations: "disabled",
      // Firefox text antialiasing can vary by a few edge pixels between
      // otherwise identical runs; keep the allowance far below 0.1%.
      maxDiffPixels: 40,
      mask: [
        snapshotCard.locator(".pae-scan-score"),
        snapshotCard.locator(".pae-scan-checks"),
        snapshotCard.locator(".pae-scan-progress"),
        snapshotCard.locator(".pae-scan-elapsed")
      ]
    });
    await snapshotCard.evaluate((snapshot) => {
      const original = snapshot.parentElement!.querySelector<HTMLElement>(
        ".pae-scan-card:not(.pae-scan-card-snapshot)"
      )!;
      snapshot.remove();
      original.hidden = false;
    });

    await expect(
      page.locator("[data-profile-authenticity-fab='visible-profile-scan']")
    ).toHaveAttribute("data-state", "complete", { timeout: 20_000 });
    await expect(overlay).toContainText("Score updated");
    await expect(page).toHaveScreenshot(`scan-overlay-success-${colorScheme}.png`, {
      animations: "disabled"
    });
  });

  test(`returns to the top and closes an incomplete scan in ${colorScheme} mode`, async ({
    page
  }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await openFixture(page, await fixture("full-scan-incomplete.html"), testInfo);

    await scanFab(page).click();
    await expect(
      page.locator("[data-profile-authenticity-fab='visible-profile-scan']")
    ).toHaveAttribute("data-state", "partial", { timeout: 20_000 });
    const overlay = page.locator(
      "[data-profile-authenticity-scan-overlay='full-profile-progress'] .pae-scan-card"
    );
    await expect(overlay).not.toBeVisible({ timeout: 5_000 });
    expect(await page.evaluate(() => document.scrollingElement!.scrollTop))
      .toBeLessThanOrEqual(4);
    await expect(scanFab(page)).toContainText("Verify authenticity again");
  });
}
