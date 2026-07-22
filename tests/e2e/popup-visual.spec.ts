import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const PROJECT_ROOT = process.cwd();

function buildTarget(testInfo: TestInfo): "chrome" | "firefox" {
  return testInfo.project.name === "firefox" ? "firefox" : "chrome";
}

function contentType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".js")) return "text/javascript";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

async function openPopup(
  page: Page,
  testInfo: TestInfo,
  viewport: { width: number; height: number } = { width: 360, height: 520 }
): Promise<void> {
  await page.addInitScript(() => {
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
            get(_keys: unknown, callback: (value: unknown) => void) {
              callback(preferences);
            },
            set(_value: unknown, callback?: () => void) { callback?.(); }
          }
        },
        tabs: {
          query(_query: unknown, callback: (tabs: unknown[]) => void) {
            callback([{ id: 1 }]);
          },
          sendMessage(_id: number, _message: unknown, callback: (response: unknown) => void) {
            callback({ status: "unsupported" });
          }
        },
        runtime: {
          getManifest() { return { version: "0.3.0" }; },
          lastError: undefined
        },
        i18n: {
          getMessage() { return ""; },
          getUILanguage() { return "en"; }
        }
      }
    });
  });

  const target = buildTarget(testInfo);
  await page.route("https://extension.test/**", async (route) => {
    const relative = new URL(route.request().url()).pathname.replace(/^\/+/, "") || "popup.html";
    const filePath = path.join(PROJECT_ROOT, "dist", target, relative);
    await route.fulfill({
      status: 200,
      contentType: contentType(filePath),
      body: await readFile(filePath)
    });
  });
  await page.setViewportSize(viewport);
  await page.goto("https://extension.test/popup.html");
  await expect(page.locator(".popup")).toBeVisible();
  await expect(page.locator(".brand-mark")).toHaveCSS("width", "40px");
}

test("keeps its intrinsic width when the initial action viewport is narrow", async ({
  page
}, testInfo) => {
  await openPopup(page, testInfo, { width: 48, height: 520 });

  const dimensions = await page.evaluate(() => ({
    app: getComputedStyle(document.querySelector("#app")!).width,
    body: getComputedStyle(document.body).width,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions).toEqual({
    app: "360px",
    body: "360px",
    scrollWidth: 360
  });
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`renders the packaged popup design in ${colorScheme} mode`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await openPopup(page, testInfo);
    await expect(page).toHaveScreenshot(`popup-${colorScheme}.png`, {
      animations: "disabled",
      fullPage: true
    });
  });
}
