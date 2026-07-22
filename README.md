# Profile Prism

**How authentic is this profile?** Profile Prism is a local-only browser extension whose purpose is to score visible LinkedIn profile authenticity evidence on an explainable 0–100 index beside the profile name.

The score describes how consistent and established the **currently rendered profile information** appears. It is not a probability, identity verification, fraud determination, safety guarantee, or employment recommendation. A polished stolen or compromised profile may score highly; a legitimate new or private profile may have limited evidence.

**Release status:** Version 0.3.0 has been submitted and is publicly available.

## Scope

- Manifest V3 WebExtension.
- Chrome, Edge, Firefox, and Safari macOS artifacts from one codebase.
- English, Portuguese, and Spanish page interpretation and UI.
- On-device processing only.
- No backend, telemetry, network enrichment, profile persistence, or private APIs.

## Development

Requirements:

- Node.js 22 or later.
- npm 10 or later.

Install and verify:

```powershell
npm.cmd install
npm.cmd run check
```

Individual commands:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd exec -- playwright install chromium firefox
npm.cmd run test:e2e
npm.cmd run build
npm.cmd run verify:privacy
npm.cmd run firefox:lint
npm.cmd run package
npm.cmd run verify:package
```

Build outputs are written to `dist/chrome`, `dist/edge`, `dist/firefox`, and `dist/safari`. Store-candidate browser ZIPs, a reviewable source ZIP, and SHA-256 checksums are written to `artifacts`. The browser-level tests use synthetic local fixtures and never open a live LinkedIn profile.

## Using the extension

After the unpacked build is loaded, open or reload a supported `https://www.linkedin.com/in/.../` page. An initial evaluation starts automatically, a numeric pill appears directly to the right of the profile name, and a **Click to verify authenticity** button appears at the bottom-left. Hover or keyboard-focus either score surface to see the same concise rationale. The toolbar popup contains the automatic-scoring switch, scan status, language preference, and privacy links; detailed criteria stay on the profile page.

LinkedIn may render lower profile sections lazily. The initial estimate refreshes when those sections appear. If the user presses **Click to verify authenticity**, a full-screen progress surface asks “How authentic is this profile?” and shows the live estimate, evidence coverage, elapsed time, and current scan stage. The extension temporarily opens LinkedIn's native **About this member** dialog (when a unique verification control is available), reads its visible verification and account-history fields, closes it, and scrolls the current profile to the bottom to load visible sections. A successful scan returns the profile to the top before publishing its completed result. The user can cancel at any time. The scan never opens collapsed “Show all” detail pages, follows links, leaves the profile route, or reads private information. Missing checks are neutral and do not erase previously observed evidence.

## Load unpacked builds

### Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select `dist/chrome`.

### Microsoft Edge

1. Open `edge://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select `dist/edge`.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `dist/firefox/manifest.json`.

### Safari macOS

Upload `dist/safari` as a ZIP to Apple's Safari Web Extension Packager in App Store Connect, or run `xcrun safari-web-extension-packager dist/safari` on macOS. Signing, actual Safari debugging, and release validation require the generated containing app and an Apple developer workflow.

## Permission model

The extension requests only:

- `storage` for the automatic-scoring pause switch, UI preferences, and ruleset metadata.
- Content-script access to `https://www.linkedin.com/*` so scoring also starts after LinkedIn SPA navigation into a profile. The controller ignores every route except `https://www.linkedin.com/in/{profile_id}/`, does not extract non-profile pages, and performs the user-triggered full visible-profile scan without adding browser permissions.

It does not request cookies, tabs, history, downloads, web requests, all-sites access, or LinkedIn API access.

## Repository documentation

- `IMPLEMENTATION_PLAN.md` — product, scoring, architecture, and delivery plan.
- `privacy/privacy-policy.md` — public privacy-policy source.
- `privacy/data-inventory.md` — normative field-level data inventory.
- `public/*-pt.html` and `public/*-es.html` — localized in-extension privacy material.
- `docs/release-checklist.md` — store and production gates.
- `docs/public-release-audit.md` — senior-review evidence, store-policy alignment, and outstanding external gates.
