import {
  extensionVersion,
  onStorageChanged,
  storageGet,
  storageSet
} from "./browser-api";

export const PREFERENCES_STORAGE_KEY = "profileAuthenticityPreferences";
export const METADATA_STORAGE_KEY = "profileAuthenticityMetadata";
export const RULESET_VERSION = "profile-evidence-v2";
export const PREFERENCES_SCHEMA_VERSION = 2;
/**
 * Kept only so version-one preference records can be interpreted during an
 * upgrade. Version two does not require or write a disclosure acceptance.
 */
export const DISCLOSURE_VERSION = "2026-07-16";

export type UiLocalePreference = "auto" | "en" | "pt" | "es";

export interface Preferences {
  enabled: boolean;
  uiLocale: UiLocalePreference;
  acceptedDisclosureVersion: typeof DISCLOSURE_VERSION | null;
}

export interface ExtensionMetadata {
  extensionVersion: string;
  rulesetVersion: typeof RULESET_VERSION;
}

const DEFAULT_PREFERENCES: Readonly<Preferences> = {
  enabled: true,
  uiLocale: "auto",
  acceptedDisclosureVersion: null
};

function isLocale(value: unknown): value is UiLocalePreference {
  return value === "auto" || value === "en" || value === "pt" || value === "es";
}

function normalizePreferences(value: unknown): Preferences {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_PREFERENCES };
  }
  const record = value as Record<string, unknown>;
  const acceptedDisclosureVersion =
    record.acceptedDisclosureVersion === DISCLOSURE_VERSION
      ? DISCLOSURE_VERSION
      : null;
  const isCurrentSchema =
    record.preferencesSchemaVersion === PREFERENCES_SCHEMA_VERSION;

  // Version one used `enabled: false` both for a fresh install waiting on its
  // first-run disclosure and for an explicit user disable. A current
  // disclosure marker is the only reliable way to distinguish the latter.
  // Version two records the schema explicitly, so an intentional pause is
  // preserved without retaining a disclosure acceptance.
  const enabled = isCurrentSchema
    ? record.enabled !== false
    : !(record.enabled === false && acceptedDisclosureVersion !== null);

  return {
    enabled,
    uiLocale: isLocale(record.uiLocale) ? record.uiLocale : "auto",
    acceptedDisclosureVersion
  };
}

export async function getPreferences(): Promise<Preferences> {
  const values = await storageGet({
    [PREFERENCES_STORAGE_KEY]: DEFAULT_PREFERENCES
  });
  return normalizePreferences(values[PREFERENCES_STORAGE_KEY]);
}

export async function savePreferences(
  changes: Partial<Preferences>
): Promise<Preferences> {
  const current = await getPreferences();
  const next = normalizePreferences({
    ...current,
    ...changes,
    acceptedDisclosureVersion: null,
    preferencesSchemaVersion: PREFERENCES_SCHEMA_VERSION
  });
  const metadata: ExtensionMetadata = {
    extensionVersion: extensionVersion(),
    rulesetVersion: RULESET_VERSION
  };
  await storageSet({
    [PREFERENCES_STORAGE_KEY]: {
      enabled: next.enabled,
      uiLocale: next.uiLocale,
      preferencesSchemaVersion: PREFERENCES_SCHEMA_VERSION
    },
    [METADATA_STORAGE_KEY]: metadata
  });
  return next;
}

export function onPreferencesChanged(
  listener: (preferences: Preferences) => void
): () => void {
  return onStorageChanged((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    const change = changes[PREFERENCES_STORAGE_KEY];
    if (!change) {
      return;
    }
    listener(normalizePreferences(change.newValue));
  });
}
