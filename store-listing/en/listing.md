# Profile Prism

## Short description

How authentic is this LinkedIn profile? Score visible authenticity evidence on-device.

## Full description

**How authentic is this profile?** Profile Prism's purpose is to score visible LinkedIn profile authenticity evidence on an explainable 0–100 index beside the name.

The automatic initial score summarizes how consistent and established the information currently rendered on that page appears. Hover or focus the name badge or bottom-left score button to see a concise explanation. Press **Click to verify authenticity** when you want the extension to scroll the current profile, load its visible sections, and inspect LinkedIn's native “About this member” details before publishing a final visible-profile result.

Important limitations:

- This is a deterministic heuristic score, not a probability.
- It is not identity verification or a determination that a person is real, fake, safe, trustworthy, or engaged in fraud.
- It cannot detect a stolen or compromised account.
- It does not read messages, job posts, contact details, other tabs, cookies, or private LinkedIn APIs.
- The complete scan runs only after your action, can be cancelled, stays on the current profile, and does not open collapsed “Show all” pages or external links.
- Do not use it as the sole basis for recruiting, employment, reporting, blocking, or trust decisions.

Privacy:

- Profile information is processed temporarily on-device.
- No profile content, URL, image, score, or evidence is retained.
- Raw verification-dialog text, organization names, URLs, and profile identifiers are discarded; only structured evidence remains in memory for the current route.
- No profile information or browsing activity is transmitted.
- There is no backend, telemetry, analytics, advertising, remote model, or external lookup.

Supported interfaces: English, Portuguese, and Spanish.

## Permission rationale

- `storage`: remembers the automatic-scoring pause switch, interface preferences, and scoring-ruleset version. It never stores profile-derived information.
- `https://www.linkedin.com/*`: keeps the extension available during LinkedIn's client-side navigation. It ignores non-profile routes and reads rendered information only on supported `/in/{profile_id}/` pages.
