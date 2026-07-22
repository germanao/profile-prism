# Public Release Maintenance Checklist

Status: **Submitted and publicly available.**

## Product and claims

- [x] Publisher name and stable Gecko extension ID finalized as `germanao` / `profile-prism@germanao`.
- [x] Public support and privacy contact published.
- [x] Claims reviewed: no “percent real,” “fake,” “scammer,” “safe,” “trusted,” or extension-created “verified.”
- [x] No bulk scoring, sorting, candidate filtering, exports, or hiring recommendations.

## Quality

- [x] `npm run check` passes from a clean checkout.
- [x] Chromium and Firefox fixture E2E tests pass.
- [x] Actual Chrome, Edge, Firefox, and Safari permission grant/deny/revoke flows pass.
- [x] Actual Safari package passes App Store release validation.
- [x] EN/PT/ES translations received human review.
- [x] Accessibility review passed keyboard, screen-reader, zoom, contrast, and reduced-motion checks.
- [x] Live smoke tests used synthetic or expressly consented test profiles only.
- [x] Model-v2 balanced calibration gate passed: three anchors, four medium established legitimate profiles, four legitimate new/private profiles, and four confirmed suspicious/fake/impersonation profiles.
- [x] All >89 safeguards and verified-but-contradictory/compromised-old-account controls pass.

## Privacy and security

- [x] Public support and privacy contact published.
- [x] Field-level data inventory matches implementation.
- [x] Store disclosures describe user-triggered scrolling and temporary native verification-dialog inspection.
- [x] Store data-use declarations describe local webpage processing and zero transmission.
- [x] No profile-derived console logging in production.
- [x] No outbound runtime request, analytics, remote code, private API, or profile persistence.
- [x] Publisher accounts use phishing-resistant MFA.
- [x] Dependency and release checksum review complete.
- [x] `npm audit --audit-level=high` reports zero vulnerabilities.

## Store artifacts

- [x] Store screenshots contain synthetic or expressly consented profiles.
- [x] Chrome ZIP submitted with localized listing and permission rationale.
- [x] Edge ZIP submitted through Partner Center with localized listing.
- [x] Firefox ZIP, source, lockfile, build instructions, and stable Gecko ID submitted to AMO.
- [x] Safari resources packaged through App Store Connect, tested in actual Safari, and submitted.

Re-run the applicable quality, privacy, packaging, and store checks for every published update.
