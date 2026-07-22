# Data Inventory

This inventory is normative for version 0.3/model v2. Any new field requires privacy review, documentation, tests, and a new store submission where required.

| Data category | Example | Purpose | Runtime state | Stored | Transmitted |
|---|---|---|---|---:|---:|
| Page route shape | `/in/profile-id/` match | Confirm supported page and reset on navigation | URL checked in tab memory | No | No |
| Page/interface language | `en`, `pt-BR`, `es` | Select parsing dictionary and UI localization | Tab memory | No | No |
| Generic LinkedIn verification badge | Badge/control visible | Explain that more details may be available; no positive identity points by itself | Tab memory | No | No |
| Structured verification methods | Government-ID, work-email, or education method shown in the native About-this-member dialog | Strong corroborating evidence | Route-local tab memory as method categories and elapsed days derived from visible dates; raw dialog text and organization names discarded | No | No |
| Account history | Join month/year and verification-maintenance interval shown in the native dialog | Account tenure and verification continuity | Route-local tab memory as elapsed days derived from the visible date | No | No |
| Profile maintenance | Contact-info and profile-photo update recency shown in the native dialog | Small recent-maintenance signal | Route-local tab memory as elapsed-day values derived from the visible recency | No | No |
| Top-card professional text | Headline and current-employer text | Cross-section consistency | Tab memory | No | No |
| About structure/text | Visible substantive summary | Completeness and consistency | Tab memory | No | No |
| Work experience | Visible role, employer, dates, description | Depth and chronology | Tab memory | No | No |
| Education structure | Visible entries only | Completeness; never infer age/prestige | Tab memory | No | No |
| Skills structure | Visible skill labels/count | Cross-section consistency | Tab memory | No | No |
| Network context | Visible connections/followers | Weak contextual evidence | Tab memory | No | No |
| Visible activity | Visible dates and content summaries | Continuity and specificity | Tab memory | No | No |
| Visible recommendations | Visible count/summary | Weak social proof | Tab memory | No | No |
| Profile-image state | Missing/default/present | Weak corroborating context | Tab memory; no pixel inspection | No | No |
| Calculated evidence | Criterion values, extraction confidence, score, coverage | Display score and explanations | Tab memory | No | No |
| Automatic-scoring preference | Running/paused | User control; running by default | Browser `storage.local` | Yes | No |
| UI preferences | Interface language | User experience | Browser `storage.local` | Yes | No |
| Full-scan interaction state | Available, scanning, complete, partial, cancelled, or failed | Explain whether the visible page was fully scanned | Route-local tab memory | No | No |
| Ruleset version | `profile-evidence-v2` | Explainability and support | Browser `storage.local` | Yes | No |

Explicitly prohibited from the evidence schema:

- Race, ethnicity, nationality, gender, age, disability, religion, politics, union status, sexuality, health, or socioeconomic status.
- Name-origin, language-quality, grammar, accent, emoji, location, school-prestige, or employer-prestige scoring.
- Facial, biometric, emotion, attractiveness, or AI-image analysis.
- Messages, contact details, cookies, authentication data, other tabs, hidden endpoints, and private APIs.

After the user presses **Click to verify authenticity**, the extension may scroll only the current profile's main scroll surface and temporarily open/close the unique native **About this member** dialog. It does not retain raw dialog text, organization names, URLs, or profile identifiers.
