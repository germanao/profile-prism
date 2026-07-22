const SHARED_TOKENS = String.raw`
  :host {
    --pae-accent: #5558d9;
    --pae-positive: #168354;
    --pae-warning: #bd4d2d;
    --pae-text: #171a33;
    --pae-secondary: #626a80;
    --pae-surface: rgb(255 255 255 / 84%);
    --pae-surface-solid: #fff;
    --pae-border: rgb(89 105 125 / 22%);
    --pae-hairline: rgb(89 105 125 / 16%);
    --pae-focus: #5558d9;
    --pae-ease: cubic-bezier(.2, .8, .2, 1);
    color-scheme: light dark;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; }
  [hidden] { display: none !important; }

  @media (prefers-color-scheme: dark) {
    :host {
      --pae-accent: #a7acff;
      --pae-positive: #5dd99b;
      --pae-warning: #ff9c7d;
      --pae-text: #f5f7fb;
      --pae-secondary: #b5bfcc;
      --pae-surface: rgb(31 38 48 / 86%);
      --pae-surface-solid: #1f2630;
      --pae-border: rgb(225 232 241 / 18%);
      --pae-hairline: rgb(225 232 241 / 13%);
      --pae-focus: #a7acff;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation: none !important;
      scroll-behavior: auto !important;
      transition: none !important;
    }
  }
`;

export const EVIDENCE_POPOVER_STYLES = `${SHARED_TOKENS}\n${String.raw`
  :host {
    all: initial;
    contain: layout paint style;
    display: block;
    inset: 0;
    pointer-events: none;
    position: fixed;
    z-index: 2147483647;
  }

  :host([hidden]) { display: none !important; }

  .pae-card {
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    backdrop-filter: blur(20px) saturate(160%);
    background: var(--pae-surface);
    border: 1px solid var(--pae-border);
    border-radius: 1.125rem;
    box-shadow: 0 24px 64px rgb(15 23 42 / 24%), 0 4px 14px rgb(15 23 42 / 10%);
    color: var(--pae-text);
    font: 400 0.875rem/1.42 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
    inline-size: min(23.75rem, calc(100vw - 1.5rem));
    max-block-size: min(35rem, calc(100vh - 1.5rem));
    overflow: hidden;
    padding: 1rem;
    pointer-events: auto;
    position: fixed;
    text-align: start;
    transform-origin: var(--pae-origin-x, 50%) var(--pae-origin-y, 0%);
    animation: pae-popover-in 180ms var(--pae-ease) both;
    overflow-wrap: anywhere;
  }

  .pae-card[data-mode="pinned"] { padding-block-start: 1.125rem; }

  .pae-close {
    appearance: none;
    align-items: center;
    background: rgb(110 123 140 / 10%);
    border: 0;
    border-radius: 50%;
    color: var(--pae-secondary);
    cursor: pointer;
    display: inline-flex;
    block-size: 2.75rem;
    inline-size: 2.75rem;
    justify-content: center;
    padding: 0;
    position: absolute;
    inset-block-start: 0.5rem;
    inset-inline-end: 0.5rem;
  }

  .pae-close:hover { background: rgb(110 123 140 / 17%); color: var(--pae-text); }
  .pae-close svg { block-size: 1rem; inline-size: 1rem; }

  .pae-card-content {
    inline-size: 100%;
    min-inline-size: 0;
  }

  /*
   * Reserve room for the absolute close button only where it can overlap.
   * Applying this padding to the whole content column previously pulled the
   * expanded scrollbar toward the center and wasted the card's right side.
   */
  .pae-card[data-mode="pinned"] .pae-authenticity-question,
  .pae-card[data-mode="pinned"] .pae-scan-mode,
  .pae-card[data-mode="pinned"] .pae-score-summary {
    padding-inline-end: 3rem;
  }

  .pae-authenticity-question {
    color: var(--pae-text);
    font-size: 1rem;
    font-weight: 740;
    letter-spacing: -0.018em;
    line-height: 1.3;
    margin: 0 0 0.45rem;
  }

  .pae-scan-mode {
    color: var(--pae-secondary);
    font-size: 0.75rem;
    font-weight: 750;
    letter-spacing: 0.065em;
    line-height: 1.25;
    margin: 0 0 0.625rem;
    text-transform: uppercase;
  }

  .pae-score-summary {
    align-items: center;
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
  }

  .pae-score {
    align-items: center;
    display: flex;
    flex: 0 0 auto;
    gap: 0.15rem;
    margin: 0;
  }

  .pae-score strong {
    font-size: 2.125rem;
    font-weight: 720;
    letter-spacing: -0.055em;
    line-height: 1;
  }

  .pae-score span {
    color: var(--pae-secondary);
    font-size: 0.75rem;
    font-weight: 650;
  }

  .pae-checked {
    background: rgb(99 112 130 / 10%);
    border: 1px solid var(--pae-hairline);
    border-radius: 999px;
    color: var(--pae-secondary);
    font-size: 0.75rem;
    font-weight: 650;
    line-height: 1.25;
    padding: 0.4rem 0.625rem;
    text-align: end;
  }

  .pae-insufficient {
    background: rgb(99 112 130 / 8%);
    border-radius: 0.875rem;
    color: var(--pae-secondary);
    font-size: 0.75rem;
    margin: 0.75rem 0 0;
    padding: 0.625rem 0.75rem;
  }

  .pae-section {
    border-block-start: 1px solid var(--pae-hairline);
    margin-block-start: 0.875rem;
    padding-block-start: 0.75rem;
  }

  .pae-section h3,
  .pae-detail-group h4 {
    font-size: 0.8125rem;
    font-weight: 720;
    letter-spacing: -0.01em;
    margin: 0 0 0.45rem;
  }

  .pae-list {
    display: grid;
    gap: 0.375rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .pae-signal {
    align-items: start;
    border-radius: 0.75rem;
    display: grid;
    gap: 0.5rem;
    grid-template-columns: 0.5rem minmax(0, 1fr) auto;
    min-block-size: 2.25rem;
    padding: 0.45rem 0.5rem;
  }

  .pae-list-highlights .pae-signal { background: rgb(99 112 130 / 7%); }

  .pae-signal-marker {
    background: var(--pae-secondary);
    block-size: 0.45rem;
    border-radius: 50%;
    inline-size: 0.45rem;
    margin-block-start: 0.35rem;
  }

  .pae-supporting .pae-signal-marker { background: var(--pae-positive); }
  .pae-caution .pae-signal-marker { background: var(--pae-warning); }

  .pae-signal-copy {
    min-inline-size: 0;
  }

  .pae-list-highlights .pae-signal-copy {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }

  .pae-impact {
    background: rgb(99 112 130 / 12%);
    border-radius: 999px;
    color: var(--pae-secondary);
    flex: 0 0 auto;
    font-size: 0.75rem;
    font-weight: 750;
    line-height: 1.2;
    padding: 0.22rem 0.4rem;
  }

  .pae-empty,
  .pae-unavailable {
    color: var(--pae-secondary);
    font-size: 0.8125rem;
    margin: 0;
  }

  .pae-expanded-details {
    border-block-start: 1px solid var(--pae-hairline);
    display: grid;
    gap: 0.875rem;
    margin-block-start: 0.75rem;
    max-block-size: min(20rem, 42vh);
    overflow: auto;
    overscroll-behavior: contain;
    padding-block-start: 0.75rem;
    padding-inline-end: 0.25rem;
    scrollbar-width: thin;
  }

  .pae-detail-group { margin: 0; }
  .pae-list-detailed .pae-signal { padding-inline: 0; }

  .pae-unavailable {
    background: rgb(99 112 130 / 8%);
    border-radius: 0.75rem;
    padding: 0.625rem 0.7rem;
  }

  .pae-disclosure {
    appearance: none;
    align-items: center;
    background: rgb(10 102 194 / 9%);
    border: 0;
    border-radius: 0.875rem;
    color: var(--pae-accent);
    cursor: pointer;
    display: flex;
    font: 700 0.8125rem/1.2 inherit;
    inline-size: 100%;
    justify-content: center;
    margin-block-start: 0.75rem;
    min-block-size: 2.75rem;
    padding: 0.625rem 0.75rem;
  }

  .pae-disclosure:hover { background: rgb(10 102 194 / 14%); }

  .pae-disclaimer {
    border-block-start: 1px solid var(--pae-hairline);
    color: var(--pae-secondary);
    font-size: 0.75rem;
    line-height: 1.35;
    margin: 0.75rem 0 0;
    padding-block-start: 0.7rem;
  }

  .pae-close:focus-visible,
  .pae-disclosure:focus-visible {
    outline: 3px solid var(--pae-focus);
    outline-offset: 2px;
  }

  @keyframes pae-popover-in {
    from { opacity: 0; transform: translateY(-4px) scale(.985); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @media (prefers-reduced-transparency: reduce) {
    .pae-card {
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
      background: var(--pae-surface-solid);
    }
  }

  @media (forced-colors: active) {
    .pae-card,
    .pae-close,
    .pae-disclosure { background: Canvas; border: 2px solid CanvasText; color: CanvasText; }
    .pae-signal-marker { background: CanvasText; }
  }

  @media (max-width: 30rem) {
    .pae-card { inline-size: calc(100vw - 1.5rem); }
  }
`}`;

export const BADGE_STYLES = `${SHARED_TOKENS}\n${String.raw`
  :host {
    all: initial;
    align-self: center;
    contain: layout paint style;
    color-scheme: light dark;
    direction: inherit;
    display: inline-flex;
    flex: 0 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
    line-height: 1;
    margin-inline-start: 0.625rem;
    vertical-align: middle;
  }

  .pae-wrap { align-items: center; display: inline-flex; }

  .pae-badge {
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    backdrop-filter: blur(20px) saturate(160%);
    appearance: none;
    align-items: center;
    background: var(--pae-surface);
    border: 1px solid var(--pae-border);
    border-radius: 999px;
    box-shadow: 0 8px 22px rgb(15 23 42 / 10%), inset 0 1px 0 rgb(255 255 255 / 35%);
    color: var(--pae-text);
    cursor: pointer;
    display: inline-flex;
    gap: 0.4rem;
    justify-content: center;
    min-block-size: 3.5rem;
    min-inline-size: 7.25rem;
    padding: 0.65rem 1rem 0.65rem 0.875rem;
    transition: transform 180ms var(--pae-ease), box-shadow 180ms var(--pae-ease), border-color 180ms var(--pae-ease);
    white-space: nowrap;
  }

  .pae-badge:hover {
    box-shadow: 0 12px 30px rgb(15 23 42 / 15%), inset 0 1px 0 rgb(255 255 255 / 42%);
    transform: translateY(-1px);
  }

  .pae-badge:active { transform: scale(.98); }

  .pae-badge:focus-visible {
    outline: 3px solid var(--pae-focus);
    outline-offset: 3px;
  }

  .pae-meter {
    align-self: center;
    background: var(--pae-secondary);
    block-size: 0.875rem;
    border: 3px solid rgb(100 112 132 / 15%);
    border-radius: 50%;
    box-sizing: content-box;
    flex: 0 0 auto;
    inline-size: 0.875rem;
  }

  .pae-badge[data-score-band="red"] .pae-meter {
    background: #d92d20;
    border-color: rgb(217 45 32 / 18%);
  }

  .pae-badge[data-score-band="orange"] .pae-meter {
    background: #e66a00;
    border-color: rgb(230 106 0 / 18%);
  }

  .pae-badge[data-score-band="yellow"] .pae-meter {
    background: #c08a00;
    border-color: rgb(192 138 0 / 18%);
  }

  .pae-badge[data-score-band="green"] .pae-meter {
    background: #168454;
    border-color: rgb(22 132 84 / 18%);
  }

  .pae-score-group {
    align-items: baseline;
    display: inline-flex;
    gap: 0.16rem;
    line-height: 1;
  }

  .pae-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 740;
    letter-spacing: -0.035em;
    line-height: 1;
  }

  .pae-scale {
    color: var(--pae-secondary);
    display: block;
    font-size: 0.8125rem;
    font-weight: 650;
    line-height: 1;
  }

  @media (prefers-reduced-transparency: reduce) {
    .pae-badge {
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
      background: var(--pae-surface-solid);
    }
  }

  @media (prefers-color-scheme: dark) {
    .pae-badge[data-score-band="red"] .pae-meter {
      background: #ff6b60;
      border-color: rgb(255 107 96 / 20%);
    }

    .pae-badge[data-score-band="orange"] .pae-meter {
      background: #ff9a4a;
      border-color: rgb(255 154 74 / 20%);
    }

    .pae-badge[data-score-band="yellow"] .pae-meter {
      background: #e7c84b;
      border-color: rgb(231 200 75 / 20%);
    }

    .pae-badge[data-score-band="green"] .pae-meter {
      background: #57d995;
      border-color: rgb(87 217 149 / 20%);
    }
  }

  @media (forced-colors: active) {
    .pae-badge { background: Canvas; border: 2px solid CanvasText; color: CanvasText; }
    .pae-meter { background: CanvasText; border: 0; }
  }
`}`;

export const FAB_STYLES = `${SHARED_TOKENS}\n${String.raw`
  :host {
    all: initial;
    bottom: 1.25rem;
    contain: layout paint style;
    color-scheme: light dark;
    direction: inherit;
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
    left: 1.25rem;
    margin: 0;
    max-inline-size: calc(100vw - 2.5rem);
    position: fixed;
    z-index: 2147483646;
  }

  .pae-fab-wrap {
    align-items: center;
    display: flex;
    gap: 0.5rem;
    max-inline-size: 100%;
  }

  .pae-fab,
  .pae-fab-aux {
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    backdrop-filter: blur(20px) saturate(160%);
    appearance: none;
    background: var(--pae-surface);
    border: 1px solid var(--pae-border);
    box-shadow: 0 16px 38px rgb(15 23 42 / 20%), inset 0 1px 0 rgb(255 255 255 / 38%);
    color: var(--pae-text);
    cursor: pointer;
    min-block-size: 4.75rem;
    transition: transform 180ms var(--pae-ease), box-shadow 180ms var(--pae-ease), inline-size 220ms var(--pae-ease), min-inline-size 220ms var(--pae-ease);
  }

  .pae-fab {
    align-items: center;
    border-radius: 999px;
    display: flex;
    gap: 0.55rem;
    justify-content: center;
    max-inline-size: min(21.25rem, calc(100vw - 7rem));
    min-inline-size: 17.5rem;
    padding: 0.8rem 1.25rem;
    white-space: nowrap;
  }

  :host([data-state="available"]) .pae-fab {
    inline-size: max-content;
    max-inline-size: min(28.75rem, calc(100vw - 2.5rem));
    min-inline-size: 22.5rem;
  }

  :host([data-state="available"]) .pae-fab-label {
    max-inline-size: none;
    overflow: visible;
    text-overflow: clip;
  }

  .pae-fab-aux {
    align-items: center;
    border-radius: 50%;
    display: inline-flex;
    flex: 0 0 auto;
    inline-size: 3.75rem;
    justify-content: center;
    min-block-size: 3.75rem;
    padding: 0;
  }

  .pae-fab:hover,
  .pae-fab-aux:hover {
    box-shadow: 0 20px 48px rgb(15 23 42 / 25%), inset 0 1px 0 rgb(255 255 255 / 45%);
    transform: translateY(-1px);
  }

  .pae-fab:active,
  .pae-fab-aux:active { transform: scale(.98); }

  .pae-fab:focus-visible,
  .pae-fab-aux:focus-visible {
    outline: 3px solid var(--pae-focus);
    outline-offset: 3px;
  }

  .pae-fab-score {
    font-size: 1.375rem;
    font-weight: 750;
    letter-spacing: -0.035em;
  }

  .pae-fab-divider { color: var(--pae-secondary); font-weight: 600; }

  .pae-fab-label {
    font-size: 1.0625rem;
    font-weight: 680;
    line-height: 1.2;
    max-inline-size: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pae-fab-icon {
    block-size: 1.25rem;
    color: currentColor;
    flex: 0 0 auto;
    inline-size: 1.25rem;
  }

  .pae-fab-chevron { animation: pae-chevron 4.8s var(--pae-ease) infinite; }

  .pae-spinner {
    animation: pae-spin .8s linear infinite;
    border: 2px solid currentColor;
    border-block-start-color: transparent;
    border-radius: 50%;
    block-size: 1rem;
    flex: 0 0 auto;
    inline-size: 1rem;
  }

  :host([data-state="complete"]) .pae-fab { border-color: rgb(22 131 84 / 42%); }
  :host([data-state="complete"]) .pae-fab-icon { color: var(--pae-positive); }
  :host([data-state="partial"]) .pae-fab,
  :host([data-state="failed"]) .pae-fab,
  :host([data-state="cancelled"]) .pae-fab { border-color: rgb(189 77 45 / 38%); }
  :host([data-state="partial"]) .pae-fab-icon,
  :host([data-state="failed"]) .pae-fab-icon { color: var(--pae-warning); }

  :host([data-compact="true"]) .pae-fab {
    min-inline-size: 7rem;
    padding-inline: 1.25rem;
  }

  :host([data-compact="true"]) .pae-fab-divider,
  :host([data-compact="true"]) .pae-fab-label,
  :host([data-compact="true"]) .pae-fab-chevron { display: none; }

  .pae-sr-only {
    block-size: 1px;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    inline-size: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
  }

  @keyframes pae-spin { to { transform: rotate(360deg); } }
  @keyframes pae-chevron {
    0%, 7%, 100% { transform: translateY(0); }
    3.5% { transform: translateY(4px); }
  }

  @media (prefers-reduced-transparency: reduce) {
    .pae-fab,
    .pae-fab-aux {
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
      background: var(--pae-surface-solid);
    }
  }

  @media (forced-colors: active) {
    .pae-fab,
    .pae-fab-aux { background: Canvas; border: 2px solid CanvasText; color: CanvasText; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pae-fab-chevron,
    .pae-spinner { animation: none !important; }
    .pae-spinner { border-block-start-color: currentColor; border-style: dotted; }
  }

  @media (max-width: 26rem) {
    :host { bottom: 0.75rem; left: 0.75rem; max-inline-size: calc(100vw - 1.5rem); }
    .pae-fab { min-inline-size: 13.5rem; max-inline-size: calc(100vw - 5rem); }
    :host([data-state="available"]) .pae-fab {
      inline-size: calc(100vw - 1.5rem);
      max-inline-size: calc(100vw - 1.5rem);
      min-inline-size: 0;
    }

    :host([data-state="available"]) .pae-fab-label {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`}`;

export const SCAN_OVERLAY_STYLES = `${SHARED_TOKENS}\n${String.raw`
  :host {
    all: initial;
    color-scheme: light dark;
    direction: inherit;
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
    inset: 0;
    position: fixed;
    z-index: 2147483647;
  }

  :host([hidden]) { display: none !important; }

  :host([data-closing="true"]) .pae-scan-overlay {
    opacity: 0;
    transform: scale(1.01);
  }

  .pae-scan-overlay {
    -webkit-backdrop-filter: blur(18px) saturate(135%);
    align-items: center;
    backdrop-filter: blur(18px) saturate(135%);
    background: rgb(7 12 20 / 68%);
    color: var(--pae-text);
    display: flex;
    inset: 0;
    justify-content: center;
    overscroll-behavior: contain;
    padding: 1rem;
    position: fixed;
    touch-action: none;
    transition: opacity 200ms var(--pae-ease), transform 200ms var(--pae-ease);
  }

  .pae-scan-card {
    -webkit-backdrop-filter: blur(24px) saturate(170%);
    backdrop-filter: blur(24px) saturate(170%);
    background: var(--pae-surface);
    border: 1px solid var(--pae-border);
    border-radius: 1.5rem;
    box-shadow: 0 32px 90px rgb(0 0 0 / 38%), inset 0 1px 0 rgb(255 255 255 / 38%);
    display: grid;
    gap: 1.5rem;
    inline-size: min(40rem, calc(100vw - 2rem));
    max-block-size: calc(100vh - 2rem);
    overflow: auto;
    padding: 2.25rem;
    text-align: start;
  }

  .pae-scan-heading {
    display: grid;
    gap: 0.5rem;
  }

  .pae-scan-kicker {
    color: var(--pae-secondary);
    font-size: 0.875rem;
    font-weight: 760;
    letter-spacing: 0.075em;
    margin: 0;
    text-transform: uppercase;
  }

  .pae-scan-title {
    color: var(--pae-text);
    font-size: 1.75rem;
    font-weight: 760;
    letter-spacing: -0.03em;
    line-height: 1.2;
    margin: 0;
  }

  .pae-scan-question {
    color: var(--pae-secondary);
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.4;
    margin: 0.125rem 0 0;
  }

  .pae-scan-activity {
    align-items: center;
    background: rgb(110 123 140 / 7%);
    border: 1px solid var(--pae-hairline);
    border-radius: 1.25rem;
    display: grid;
    gap: 1.25rem;
    grid-template-columns: 4.75rem 1fr;
    padding: 1.25rem;
  }

  .pae-scan-spinner,
  .pae-scan-result-icon {
    align-items: center;
    block-size: 4.75rem;
    border-radius: 50%;
    display: inline-flex;
    inline-size: 4.75rem;
    justify-content: center;
  }

  .pae-scan-spinner {
    animation: pae-overlay-spin .9s linear infinite;
    border: 5px solid rgb(100 112 132 / 22%);
    border-block-start-color: var(--pae-accent);
  }

  .pae-scan-result-icon {
    background: rgb(22 131 84 / 13%);
    color: var(--pae-positive);
  }

  .pae-scan-result-icon[data-tone="warning"] {
    background: rgb(189 77 45 / 13%);
    color: var(--pae-warning);
  }

  .pae-scan-result-icon svg {
    block-size: 2.25rem;
    inline-size: 2.25rem;
  }

  .pae-scan-stage {
    color: var(--pae-text);
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1.35;
    margin: 0;
  }

  .pae-scan-elapsed {
    color: var(--pae-secondary);
    font-size: 0.9375rem;
    line-height: 1.4;
    margin: 0.3rem 0 0;
  }

  .pae-scan-score-panel {
    align-items: end;
    background: rgb(110 123 140 / 9%);
    border: 1px solid var(--pae-hairline);
    border-radius: 1.25rem;
    display: flex;
    justify-content: space-between;
    padding: 1.25rem;
  }

  .pae-scan-score-copy {
    display: grid;
    gap: 0.4rem;
  }

  .pae-scan-score-label {
    color: var(--pae-secondary);
    font-size: 1rem;
    font-weight: 650;
  }

  .pae-scan-score {
    color: var(--pae-text);
    font-size: 3.5rem;
    font-weight: 780;
    letter-spacing: -0.055em;
    line-height: 0.95;
  }

  .pae-scan-scale {
    color: var(--pae-secondary);
    font-size: 1rem;
    font-weight: 650;
    letter-spacing: 0;
    margin-inline-start: 0.2rem;
  }

  .pae-scan-checks {
    color: var(--pae-secondary);
    font-size: 0.9375rem;
    font-weight: 650;
    margin: 0;
    text-align: end;
  }

  .pae-scan-progress {
    appearance: none;
    background: rgb(100 112 132 / 16%);
    block-size: 0.625rem;
    border: 0;
    border-radius: 999px;
    inline-size: 100%;
    overflow: hidden;
  }

  .pae-scan-progress::-webkit-progress-bar {
    background: rgb(100 112 132 / 16%);
    border-radius: 999px;
  }

  .pae-scan-progress::-webkit-progress-value {
    background: var(--pae-accent);
    border-radius: 999px;
    transition: inline-size 220ms var(--pae-ease);
  }

  .pae-scan-progress::-moz-progress-bar {
    background: var(--pae-accent);
    border-radius: 999px;
  }

  .pae-scan-message {
    color: var(--pae-secondary);
    font-size: 1rem;
    line-height: 1.45;
    margin: 0;
  }

  .pae-scan-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  .pae-scan-button {
    appearance: none;
    background: rgb(110 123 140 / 11%);
    border: 1px solid var(--pae-border);
    border-radius: 999px;
    color: var(--pae-text);
    cursor: pointer;
    font: 700 1rem/1 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
    min-block-size: 3.25rem;
    min-inline-size: 7.5rem;
    padding: 0.875rem 1.25rem;
  }

  .pae-scan-button-primary {
    background: var(--pae-accent);
    border-color: transparent;
    color: #fff;
  }

  .pae-scan-button:hover { filter: brightness(1.05); }
  .pae-scan-button:active { transform: scale(.98); }
  .pae-scan-button:focus-visible {
    outline: 3px solid var(--pae-focus);
    outline-offset: 3px;
  }

  .pae-sr-only {
    block-size: 1px;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    inline-size: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
  }

  @keyframes pae-overlay-spin { to { transform: rotate(360deg); } }

  @media (prefers-reduced-transparency: reduce) {
    .pae-scan-overlay {
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
      background: rgb(7 12 20 / 88%);
    }

    .pae-scan-card {
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
      background: var(--pae-surface-solid);
    }
  }

  @media (forced-colors: active) {
    .pae-scan-overlay { background: Canvas; }
    .pae-scan-card,
    .pae-scan-button,
    .pae-scan-score-panel { border: 2px solid CanvasText; }
    .pae-scan-spinner { border-color: CanvasText; border-block-start-color: Highlight; }
    .pae-scan-button-primary { background: Highlight; color: HighlightText; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pae-scan-spinner {
      animation: none !important;
      border-block-start-color: currentColor;
      border-style: dotted;
    }
  }

  @media (max-width: 30rem) {
    .pae-scan-card {
      border-radius: 1.125rem;
      gap: 1.25rem;
      padding: 1.25rem;
    }

    .pae-scan-title { font-size: 1.5rem; }
    .pae-scan-activity {
      gap: 1rem;
      grid-template-columns: 4rem 1fr;
      padding: 1rem;
    }
    .pae-scan-spinner,
    .pae-scan-result-icon {
      block-size: 4rem;
      inline-size: 4rem;
    }
    .pae-scan-stage { font-size: 1.125rem; }
    .pae-scan-score { font-size: 3rem; }
    .pae-scan-score-panel {
      align-items: start;
      flex-direction: column;
      gap: 0.75rem;
    }
    .pae-scan-checks { text-align: start; }
    .pae-scan-actions { flex-direction: column-reverse; }
    .pae-scan-button { inline-size: 100%; }
  }
`}`;
