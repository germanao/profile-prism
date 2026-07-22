# Public Release Audit

Audit date: 2026-07-22

## Verdict

The version 0.3.0 codebase and generated browser archives are technically approved for public distribution. Automated quality, privacy, security, packaging, Chromium, and Firefox browser checks pass.

The extension has been submitted and is publicly available through its supported distribution channels.

## Technical release evidence

- Manifest V3 packages are produced for Chrome, Edge, Firefox, and Safari from one source tree.
- Runtime permissions are limited to `storage` plus the declared LinkedIn content-script match.
- The content controller ignores non-profile routes and pauses when disabled or hidden.
- The extension has no backend, runtime fetch, telemetry, analytics, remote code, or profile persistence.
- The extension-page CSP limits scripts and styles to packaged resources and sets `connect-src 'none'`.
- All profile text is rendered with DOM text nodes; the codebase contains no HTML-string injection, `eval`, or `new Function` runtime path.
- Profile evidence and route identifiers remain in tab memory and are cleared on route change, disablement, or teardown.
- The Firefox manifest declares `data_collection_permissions.required: ["none"]` and uses the stable ID `profile-prism@germanao`.
- Mozilla's direct `addons-linter` runs with warnings treated as errors. The prior `web-ext` wrapper was removed because its development-only ZIP dependency had an unresolved high-severity advisory.
- Type checking and all 254 unit/component/integration tests pass; the Chromium and Firefox fixture suites each pass all 17 browser and visual checks.
- The npm dependency audit reports zero known vulnerabilities.
- Store ZIPs and the AMO reviewer source ZIP are reproducible and receive SHA-256 checksums.
- Store-sized 1280×800 screenshots use synthetic fixtures and are maintained under `tests/e2e/*-snapshots/`.

## Store alignment

### Chrome Web Store

The published extension has one narrow purpose, a complete localized description, packaged icons, synthetic screenshots, minimum permissions, and consistent privacy disclosures. Its stable public privacy policy and Chrome privacy questionnaire match `privacy/data-inventory.md`.

Reference: [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies).

### Microsoft Edge Add-ons

The published package requests only necessary permissions, contains no remote or obfuscated runtime behavior, and includes localized, non-misleading descriptions. Its public privacy-policy URL and Partner Center disclosures describe local processing and zero transmission.

References: [Edge Add-ons developer policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies) and [publishing an Edge extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension).

### Firefox Add-ons

The Firefox archive passes Mozilla's linter with zero errors, warnings, or notices. Because the shipped JavaScript is bundled and minified, every AMO version includes `profile-prism-source-0.3.0.zip`, the lockfile, and the build instructions in `README.md`. The public AMO listing includes its support site and license.

References: [submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/), [source-code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/), and [Firefox built-in data consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).

### Safari / App Store

`profile-prism-safari-0.3.0.zip` is the reproducible web-extension input used to produce the signed Safari containing app. The public App Store distribution includes its privacy labels, screenshots, signing, and App Review record.

References: [Safari Web Extension Packager](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect) and [Safari extension distribution](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension).

## Ongoing release maintenance

- Keep the monitored support and privacy URL current across every store listing.
- Re-run balanced calibration, human EN/PT/ES review, and accessibility review when scoring or user-facing copy changes.
- Run live smoke tests in current Chrome, Edge, and Firefox using synthetic or expressly consented test profiles for every release update.
- Package, sign, and validate Safari updates through App Store Connect.
- Keep phishing-resistant MFA enabled on publisher accounts and retain final artifact checksums with each release record.
- Keep the published Gecko ID `profile-prism@germanao` stable across updates.

## Senior engineering review focus

- **Site resilience:** LinkedIn owns the DOM and may change it without notice. Extraction remains conservative and unavailable evidence is neutral, but selector drift requires monitored fixture maintenance.
- **Decision safety:** The score is an evidence-strength heuristic, not identity verification, fraud detection, or a hiring recommendation. Store copy and UI must preserve that limitation.
- **Bias and misuse:** Protected traits, prestige proxies, language quality, biometrics, and private data are excluded. Review future scoring changes against the normative data inventory.
- **Performance:** Mutation work is scoped, coalesced, cached, and paused off-route or when hidden. Keep the mutation-storm and lazy-loading regression tests in the release gate.
- **Supply chain:** Production packages contain bundled local code only. Review lockfile changes, run the dependency audit, and regenerate checksums for every release.

## Release decision record

Technical release: **PASS**

Public-store status: **SUBMITTED AND PUBLICLY AVAILABLE**

Current release line: **0.3.0 / profile-evidence-v2**
