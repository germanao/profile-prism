import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyProfileEvidence } from "../../src/scoring/evidence-schema";

const extractorMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/extractors/profile-extractor", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/extractors/profile-extractor")
  >("../../src/extractors/profile-extractor");
  return { ...actual, extractProfileEvidence: extractorMock };
});

import { MountController } from "../../src/content/mount-controller";
import {
  PREFERENCES_SCHEMA_VERSION,
  PREFERENCES_STORAGE_KEY
} from "../../src/platform/storage";

describe("MountController automatic lifecycle", () => {
  let storageListener:
    | ((changes: Record<string, { newValue?: unknown }>, area: string) => void)
    | undefined;

  beforeEach(() => {
    document.body.innerHTML = "<main><h1>Ada Lovelace</h1></main>";
    extractorMock.mockReset();
    extractorMock.mockReturnValue(createEmptyProfileEvidence("fixture"));

    const chromeMock = {
      storage: {
        local: {
          get(defaults: Record<string, unknown>, callback: (result: Record<string, unknown>) => void) {
            callback(defaults);
          },
          set(_next: Record<string, unknown>, callback: () => void) { callback(); }
        },
        onChanged: {
          addListener(listener: typeof storageListener) { storageListener = listener; },
          removeListener() { storageListener = undefined; }
        }
      },
      runtime: {
        getURL(path: string) { return `chrome-extension://test/${path}`; },
        getManifest() { return { version: "0.3.0" }; },
        onMessage: { addListener() {}, removeListener() {} }
      },
      i18n: { getMessage() { return ""; }, getUILanguage() { return "en"; } }
    };
    Object.defineProperty(globalThis, "chrome", {
      value: chromeMock,
      configurable: true,
      writable: true
    });
    Object.defineProperty(globalThis, "browser", {
      value: undefined,
      configurable: true,
      writable: true
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "chrome");
    Reflect.deleteProperty(globalThis, "browser");
  });

  it("extracts and mounts automatically, then honors an explicit pause", async () => {
    const location = {
      href: "https://www.linkedin.com/in/ada-lovelace/"
    } as Location;
    const controller = new MountController({ document, location });
    await controller.start();

    expect(extractorMock).toHaveBeenCalledOnce();
    expect(controller.publicState()).toMatchObject({
      status: "ready",
      result: { score: 50, coveragePercent: 0 },
      badgeMounted: true
    });
    expect(document.querySelector("[data-profile-authenticity-host]")).not.toBeNull();
    expect(document.querySelectorAll(
      '[data-profile-authenticity-overlay="profile-evidence-details"]'
    )).toHaveLength(1);
    expect(document.querySelectorAll(
      '[data-profile-authenticity-host="profile-evidence-badge"]'
    )).toHaveLength(1);
    expect(document.querySelectorAll(
      '[data-profile-authenticity-fab="visible-profile-scan"]'
    )).toHaveLength(1);

    storageListener?.(
      {
        [PREFERENCES_STORAGE_KEY]: {
          newValue: {
            enabled: false,
            uiLocale: "en",
            preferencesSchemaVersion: PREFERENCES_SCHEMA_VERSION
          }
        }
      },
      "local"
    );

    expect(extractorMock).toHaveBeenCalledOnce();
    expect(controller.publicState()).toEqual({ status: "disabled" });
    expect(document.querySelector("[data-profile-authenticity-host]")).toBeNull();
    expect(document.querySelector("[data-profile-authenticity-overlay]")).toBeNull();

    storageListener?.(
      {
        [PREFERENCES_STORAGE_KEY]: {
          newValue: {
            enabled: true,
            uiLocale: "en",
            preferencesSchemaVersion: PREFERENCES_SCHEMA_VERSION
          }
        }
      },
      "local"
    );
    expect(extractorMock).toHaveBeenCalledTimes(2);
    expect(controller.publicState()).toMatchObject({
      status: "ready",
      badgeMounted: true
    });
    controller.stop();
  });

  it("remounts the badge after LinkedIn replaces it in the name row", async () => {
    const location = {
      href: "https://www.linkedin.com/in/ada-lovelace/"
    } as Location;
    const controller = new MountController({ document, location });
    await controller.start();

    const original = document.querySelector(
      '[data-profile-authenticity-host="profile-evidence-badge"]'
    );
    expect(original).not.toBeNull();
    original?.remove();

    await vi.waitFor(() => {
      const replacement = document.querySelector(
        '[data-profile-authenticity-host="profile-evidence-badge"]'
      );
      expect(replacement).not.toBeNull();
      expect(replacement).not.toBe(original);
    });
    expect(extractorMock).toHaveBeenCalledOnce();
    expect(controller.publicState()).toMatchObject({
      status: "ready",
      badgeMounted: true
    });
    controller.stop();
  });
});
