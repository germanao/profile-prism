# Privacy Policy

Last updated: 2026-07-16

## Summary

**How authentic is this profile?** Profile Prism's purpose is to score visible LinkedIn profile authenticity evidence on an explainable 0–100 index. It processes selected information that is already rendered on the LinkedIn profile page open in your browser. Processing happens temporarily in the extension's content script on your device. Profile-derived information is not sent to the developer or any third party and is not retained after the page is closed, replaced, or navigated away from.

The extension is an independent heuristic aid. It is not identity verification, a fraud determination, a safety guarantee, or an employment-screening service.

## Information processed on-device

On a supported LinkedIn profile page, an initial evaluation starts by default and the extension may temporarily read:

- Whether LinkedIn displays a generic verification badge.
- Visible profile headline, About, Experience, Skills, and Education structure.
- Visible work titles, employers, descriptions, and date ranges.
- Visible connection or follower count.
- Visible Activity and recommendation summaries.
- Whether a profile image is present or is a default/non-person image. The extension does not inspect image pixels.
- Page language and visible section labels needed to interpret English, Portuguese, or Spanish interfaces.

If the user presses **Click to verify authenticity**, the extension may additionally:

- Temporarily open LinkedIn's native **About this member** dialog, wait for its visible content, read structured government-ID, work-email, or education verification methods, account join date, verification date, and contact/photo update recency, then close the dialog.
- Scroll the current profile page to load additional visible profile sections and update the score from accumulated evidence.

The full visible-profile scan is never started automatically. It can be cancelled, remains on the current profile, and does not open collapsed “Show all” pages or external links.

The complete field-level inventory is in `data-inventory.md`.

## Information not processed

The extension does not read or process:

- LinkedIn messages, job posts, contact-information dialogs, cookies, authentication tokens, or other tabs.
- Hidden information or LinkedIn private/internal APIs.
- Email addresses, phone numbers, resumes, financial information, government identifier values, or attachments. A visible statement that LinkedIn verified a government ID may be classified as a verification method, but the ID itself is never read.
- Facial identity, biometric data, inferred demographics, photo authenticity, or whether an image is AI-generated.

## Storage and retention

Profile names, URLs, page contents, images, scores, and contributing observations are kept in tab memory only and are not written to browser storage.

The extension may store these preferences locally in the browser:

- Whether automatic profile evaluation is paused.
- UI preferences.
- Extension and scoring-ruleset version.

Preferences contain no profile-derived information. The extension does not use synchronized storage.

## Transmission and sharing

The extension makes no runtime network requests. It has no backend, telemetry, analytics, advertising, remote model, remote configuration, or third-party enrichment. No profile-derived information or browsing activity is transmitted or shared.

## Permissions

- `storage`: stores extension preferences and ruleset version locally.
- Access to `https://www.linkedin.com/*`: lets the content script remain available across LinkedIn's client-side navigation. It ignores all routes except supported `/in/{profile_id}/` pages and reads profile information only on those routes.

The extension does not request access to all websites, cookies, history, downloads, web requests, or other tabs.

## User controls

Users can pause automatic evaluation from the extension popup, cancel a running full scan from the on-page button or keyboard, revoke LinkedIn site access using browser extension settings, clear local extension storage, or uninstall the extension. Pausing or uninstalling stops all processing.

## Children

The extension is designed for professional networking contexts and is not directed to children.

## Changes

Material changes to processed fields, permissions, retention, or transmission require updated disclosures and a new reviewed extension release. The version date above will be updated.

## Contact

Support and privacy inquiries: `https://github.com/germanao/profile-prism/issues`
