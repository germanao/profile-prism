# Store Reviewer Notes

## Purpose

**How authentic is this profile?** The extension's purpose is to score visible profile authenticity evidence locally and explain every contribution. It does not claim identity verification, fraud detection, or calibrated probability.

## How to test safely

1. Install the submitted package.
2. Use the synthetic reviewer fixture supplied separately with the submission or an expressly consented test profile.
3. Confirm that a numeric badge appears automatically beside the profile name without an action in the toolbar popup.
4. Hover or keyboard-focus the name badge or bottom-left score button to inspect the same concise score rationale and limitations.
5. Press **Click to verify authenticity**. Confirm that the full-screen progress surface asks “How authentic is this profile?” and reports the live estimate and current stage while the extension temporarily opens/closes the unique native “About this member” dialog when available and scrolls only the current profile. A successful scan returns to the top before showing the completed result. Escape or the modal Cancel control cancels it.
6. Open the toolbar popup to pause/re-enable automatic processing, inspect scan status, or change the interface language. Detailed score criteria remain on the profile page.

## Data handling

- Visible profile fields and derived evidence remain in content-script/tab memory.
- Only extension preferences, extension version, and ruleset version are stored locally.
- The extension produces no runtime network requests and has no backend.
- The extension does not access messages, contact information, cookies, authentication data, hidden endpoints, other tabs, or private APIs.
- User-triggered scrolling and native verification-dialog inspection are route-scoped and never persist raw text, organization names, URLs, or profile identifiers.

## Build reproduction

```text
npm ci
npm run check
```

The TypeScript source, lockfile, build scripts, and exact dependency versions are included with reviewer source materials. Output archives are generated in `artifacts/` with SHA-256 checksums.
