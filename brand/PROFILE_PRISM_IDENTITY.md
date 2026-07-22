# Profile Prism visual identity

## Brand idea

**Reveal the signals behind the profile.**

Profile Prism helps people inspect visible profile evidence with more context. The identity represents one profile passing through a prism and becoming several explainable signals. It should feel intelligent, calm, private, and useful—never accusatory or absolute.

## Logo

The mark is an abstract **P** that also acts as a prism:

- The white beam represents the visible profile information being inspected.
- The three outgoing rays represent multiple independent evidence dimensions.
- The open, directional construction communicates explanation rather than certification.
- The rounded midnight tile keeps the mark recognizable in browser toolbars and stores.

Primary assets:

- `brand/profile-prism-brand-board.svg` — visual identity overview.
- `build/build.mjs` — deterministic icon geometry used to generate the shipped browser icons.
- `store-assets/chrome-web-store/store-icon-128.png` — store-ready rendering of the generated 128 px icon.
- Browser PNGs are generated at 16, 32, 48, and 128 px during every build.

Keep clear space around the mark equal to at least one-quarter of the tile width. Do not add a checkmark, shield, identity card, fingerprint, or the LinkedIn “in” symbol.

## Color

| Role | Name | Hex | Use |
|---|---|---:|---|
| Foundation | Midnight | `#171A3A` | Icon tile, dark brand fields |
| Primary | Prism Iris | `#7C83FF` | Main prism facet, illustration |
| UI primary | Deep Iris | `#5558D9` | Accessible controls and links on light surfaces |
| Secondary | Signal Aqua | `#46D7C4` | Evidence ray, informational accent |
| Highlight | Signal Amber | `#FFB84D` | Evidence ray, coverage highlight |
| Light | Cloud | `#F8FAFF` | Beam, light text, backgrounds |
| Ink | Night Ink | `#171A33` | Primary text |

Score-state colors remain semantic and are not part of the logo: green means stronger visible evidence, amber means limited or incomplete evidence, and red is reserved for operational errors. A low score must not be branded as “fake.”

## Typography

- Brand and marketing headings: **Inter**, 700.
- Product UI: the operating-system sans-serif stack for fast, private, dependency-free rendering.
- Body copy: Inter 400–500 where available.
- Use sentence case. Avoid all-caps headings except compact UI labels.

## Voice

Profile Prism is:

- Evidence-led, not judgmental.
- Clear about uncertainty and missing information.
- Reassuring about on-device processing.
- Direct, concise, and free of security theater.

Preferred language: “visible evidence,” “signals,” “coverage,” “consistent,” and “on-device.”

Avoid: “verified,” “safe,” “trusted,” “real,” “fake,” “fraud detected,” or any promise of identity verification.

## Naming

- Product name: **Profile Prism**
- Store subtitle: **Visible profile evidence, explained on-device**
- Tagline: **Reveal the signals behind the profile.**
- Compact metric name: **Profile evidence**

The product name is not translated. Descriptive copy and the metric name are localized.

## Accessibility

- Use Deep Iris (`#5558D9`) rather than Prism Iris for small text on light backgrounds.
- Retain a visible focus ring independent of color.
- Never encode evidence quality with color alone; always pair it with a number or label.
- The 16 px icon uses the same silhouette as larger sizes with simplified, thick rays.
