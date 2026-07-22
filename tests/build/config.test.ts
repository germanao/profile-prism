import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(
    await readFile(path.join(root, relativePath), "utf8")
  ) as T;
}

describe("store manifests", () => {
  it("keeps the base permission surface narrow", async () => {
    const manifest = await readJson<{
      permissions?: string[];
      host_permissions?: string[];
      optional_permissions?: string[];
      optional_host_permissions?: string[];
      background?: unknown;
      externally_connectable?: unknown;
      web_accessible_resources?: unknown;
      content_security_policy?: { extension_pages?: string };
      content_scripts?: Array<{
        matches?: string[];
        css?: string[];
        run_at?: string;
      }>;
    }>("build/manifests/base.json");

    expect(manifest.permissions).toEqual(["storage"]);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.optional_permissions).toBeUndefined();
    expect(manifest.optional_host_permissions).toBeUndefined();
    expect(manifest.background).toBeUndefined();
    expect(manifest.externally_connectable).toBeUndefined();
    expect(manifest.web_accessible_resources).toBeUndefined();
    expect(manifest.content_security_policy?.extension_pages).toContain(
      "script-src 'self'"
    );
    expect(manifest.content_security_policy?.extension_pages).toContain(
      "connect-src 'none'"
    );
    expect(manifest.content_scripts?.flatMap((item) => item.matches ?? [])).toEqual([
      "https://www.linkedin.com/*"
    ]);
    expect(manifest.content_scripts?.[0]?.run_at).toBe("document_idle");
    expect(manifest.content_scripts?.[0]?.css).toEqual(["content.css"]);
  });

  it("declares no Firefox collection or transmission", async () => {
    const overlay = await readJson<{
      browser_specific_settings: {
        gecko: {
          id: string;
          strict_min_version: string;
          data_collection_permissions: { required: string[] };
        };
      };
    }>("build/manifests/firefox.json");

    expect(overlay.browser_specific_settings.gecko.id).toBe(
      "profile-prism@germanao"
    );
    expect(Number.parseInt(overlay.browser_specific_settings.gecko.strict_min_version, 10)).toBeGreaterThanOrEqual(142);
    expect(
      overlay.browser_specific_settings.gecko.data_collection_permissions.required
    ).toEqual(["none"]);
  });

  it("ships the popup design as a CSP-safe packaged stylesheet", async () => {
    const [html, css, entry, buildScript] = await Promise.all([
      readFile(path.join(root, "public/popup.html"), "utf8"),
      readFile(path.join(root, "public/popup.css"), "utf8"),
      readFile(path.join(root, "src/ui/popup-entry.ts"), "utf8"),
      readFile(path.join(root, "build/build.mjs"), "utf8")
    ]);

    expect(html).toContain('<link rel="stylesheet" href="popup.css">');
    expect(entry).not.toContain('createElement("style")');
    expect(entry).not.toContain("POPUP_STYLES");
    expect(css).toContain("min-inline-size: 22.5rem");
    expect(css).toContain("#app");
    expect(css).not.toContain("min(22.5rem, 100vw)");
    expect(css).toContain("backdrop-filter: blur(20px) saturate(160%)");
    expect(css).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(buildScript).toContain('copyIfExists("public", outdir)');
  });

  it("ships the native-dialog suppression rule as packaged content CSS", async () => {
    const css = await readFile(path.join(root, "public/content.css"), "utf8");
    expect(css).toContain(
      '[data-profile-authenticity-native-inspection="suppressed"]'
    );
    expect(css).toContain("filter: opacity(0) !important");
    expect(css).toContain("::backdrop");
    expect(css).not.toMatch(/https?:\/\//u);
  });
});

describe("localization packages", () => {
  for (const locale of ["en", "pt_BR", "pt_PT", "es", "es_419"]) {
    it(`contains required manifest strings for ${locale}`, async () => {
      const messages = await readJson<Record<string, { message?: string }>>(
        `src/_locales/${locale}/messages.json`
      );
      for (const key of [
        "extensionName",
        "extensionShortName",
        "extensionDescription",
        "actionTitle"
      ]) {
        expect(messages[key]?.message?.trim()).toBeTruthy();
      }
      expect(messages.extensionDescription?.message).toMatch(
        /authentic|autêntico|auténtico/iu
      );
      expect(
        messages.extensionDescription?.message?.length
      ).toBeLessThanOrEqual(132);
    });
  }
});

describe("privacy documentation", () => {
  it("states ephemeral processing and zero transmission", async () => {
    const policy = await readFile(
      path.join(root, "privacy/privacy-policy.md"),
      "utf8"
    );
    expect(policy).toContain("temporarily");
    expect(policy).toContain("makes no runtime network requests");
    expect(policy).toContain("not retained");
  });

  it.each(["pt", "es"])("ships localized public privacy material for %s", async (locale) => {
    const [policy, inventory] = await Promise.all([
      readFile(path.join(root, `public/privacy-policy-${locale}.html`), "utf8"),
      readFile(path.join(root, `public/data-inventory-${locale}.html`), "utf8")
    ]);
    expect(policy).toContain(`<html lang="${locale}`);
    expect(inventory).toContain(`<html lang="${locale}`);
    expect(policy).not.toContain("Profile Prism processes information");
  });
});
