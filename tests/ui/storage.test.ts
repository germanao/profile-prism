import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DISCLOSURE_VERSION,
  METADATA_STORAGE_KEY,
  PREFERENCES_SCHEMA_VERSION,
  PREFERENCES_STORAGE_KEY,
  getPreferences,
  savePreferences
} from "../../src/platform/storage";

describe("local preferences storage", () => {
  let values: Record<string, unknown>;

  beforeEach(() => {
    values = {};
    const chromeMock = {
      storage: {
        local: {
          get(defaults: Record<string, unknown>, callback: (result: Record<string, unknown>) => void) {
            callback({ ...defaults, ...values });
          },
          set(next: Record<string, unknown>, callback: () => void) {
            Object.assign(values, next);
            callback();
          }
        },
        onChanged: { addListener() {}, removeListener() {} }
      },
      runtime: {
        getURL(path: string) { return `chrome-extension://test/${path}`; },
        getManifest() { return { version: "0.3.0" }; },
        onMessage: { addListener() {}, removeListener() {} }
      }
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

  it("defaults to automatic scoring and stores an explicit pause plus version metadata only", async () => {
    await expect(getPreferences()).resolves.toEqual({
      enabled: true,
      uiLocale: "auto",
      acceptedDisclosureVersion: null
    });

    await savePreferences({ enabled: false, uiLocale: "pt" });
    expect(Object.keys(values).sort()).toEqual([
      METADATA_STORAGE_KEY,
      PREFERENCES_STORAGE_KEY
    ].sort());
    expect(values[PREFERENCES_STORAGE_KEY]).toEqual({
      enabled: false,
      uiLocale: "pt",
      preferencesSchemaVersion: PREFERENCES_SCHEMA_VERSION
    });
    expect(values[METADATA_STORAGE_KEY]).toEqual({
      extensionVersion: "0.3.0",
      rulesetVersion: "profile-evidence-v2"
    });

    await expect(getPreferences()).resolves.toEqual({
      enabled: false,
      uiLocale: "pt",
      acceptedDisclosureVersion: null
    });
  });

  it("turns an unaccepted version-one first-run gate into automatic scoring", async () => {
    values[PREFERENCES_STORAGE_KEY] = {
      enabled: false,
      uiLocale: "es",
      acceptedDisclosureVersion: "outdated-policy"
    };

    await expect(getPreferences()).resolves.toEqual({
      enabled: true,
      uiLocale: "es",
      acceptedDisclosureVersion: null
    });
  });

  it("preserves a version-one explicit disable and a version-two pause", async () => {
    values[PREFERENCES_STORAGE_KEY] = {
      enabled: false,
      uiLocale: "en",
      acceptedDisclosureVersion: DISCLOSURE_VERSION
    };
    await expect(getPreferences()).resolves.toMatchObject({ enabled: false });

    values[PREFERENCES_STORAGE_KEY] = {
      enabled: false,
      uiLocale: "en",
      preferencesSchemaVersion: PREFERENCES_SCHEMA_VERSION
    };
    await expect(getPreferences()).resolves.toEqual({
      enabled: false,
      uiLocale: "en",
      acceptedDisclosureVersion: null
    });
  });
});
