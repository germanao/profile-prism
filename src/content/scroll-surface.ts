import { isElementRendered } from "../extractors/dom";

const EXCLUDED_SCAN_REGION = [
  "aside",
  "[role='complementary']",
  "[role='dialog']",
  "[data-profile-authenticity-host]",
  "[class*='msg-overlay']",
  "[class*='messaging']",
  "[id*='messaging']",
  "[aria-label*='messaging' i]",
  "[aria-label*='chat' i]",
].join(", ");

const BUSY_SELECTOR = [
  "[aria-busy='true']",
  "[role='progressbar']",
  "progress",
  ".artdeco-loader",
  "[data-test-loading='true']",
].join(", ");

export interface ScrollMetrics {
  top: number;
  height: number;
  viewport: number;
}

export interface ScrollSurface {
  readonly kind: "element" | "document";
  readonly element: HTMLElement;
  readonly contentRoot: HTMLElement;
  metrics(): ScrollMetrics;
  setTop(top: number): void;
  isConnected(): boolean;
}

export interface ReturnSurfaceToTopOptions {
  signal?: AbortSignal;
  intervalMs?: number;
  requiredStableChecks?: number;
  maximumChecks?: number;
}

function isExcluded(element: Element): boolean {
  return element.matches(EXCLUDED_SCAN_REGION) || element.closest(EXCLUDED_SCAN_REGION) !== null;
}

function candidateScore(element: HTMLElement): number {
  let score = 0;
  if (element.querySelector("h1, h2, [role='heading']")) score += 4;
  if (element.querySelector("a[href*='/in/']")) score += 3;
  if (element.querySelector("section")) score += 2;
  score += Math.min(2, (element.textContent?.trim().length ?? 0) / 1_000);
  return score;
}

export function findProfileContentRoot(document: Document): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>("main, [role='main']"),
  ).filter((candidate) => !isExcluded(candidate) && isElementRendered(candidate));
  return candidates.sort((left, right) => candidateScore(right) - candidateScore(left))[0] ?? null;
}

function canElementScroll(element: HTMLElement): boolean {
  if (element.clientHeight <= 0 || element.scrollHeight <= element.clientHeight + 4) return false;
  const view = element.ownerDocument.defaultView;
  const overflow = view?.getComputedStyle(element).overflowY ?? "";
  return /^(auto|scroll|overlay)$/u.test(overflow);
}

function documentScrollElements(document: Document): HTMLElement[] {
  return Array.from(new Set([
    document.scrollingElement as HTMLElement | null,
    document.documentElement,
    document.body,
  ].filter((candidate): candidate is HTMLElement => candidate != null)));
}

function finiteScrollPosition(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

function metricsFor(element: HTMLElement, documentSurface: boolean): ScrollMetrics {
  const document = element.ownerDocument;
  const view = document.defaultView;
  if (documentSurface) {
    const scrollElements = documentScrollElements(document);
    const viewport = Math.max(
      0,
      element.clientHeight ||
        document.documentElement?.clientHeight ||
        view?.innerHeight ||
        0,
    );
    const top = Math.max(
      finiteScrollPosition(view?.scrollY),
      finiteScrollPosition(view?.pageYOffset),
      ...scrollElements.map((candidate) => finiteScrollPosition(candidate.scrollTop)),
    );
    const height = Math.max(
      viewport,
      ...scrollElements.flatMap((candidate) => [
        candidate.scrollHeight,
        candidate.offsetHeight,
        candidate.clientHeight,
      ]),
    );
    return { top, height, viewport };
  }

  const viewport = element.clientHeight;
  return {
    top: Math.max(0, element.scrollTop),
    height: Math.max(viewport, element.scrollHeight),
    viewport: Math.max(0, viewport),
  };
}

function createSurface(
  element: HTMLElement,
  contentRoot: HTMLElement,
  kind: ScrollSurface["kind"],
): ScrollSurface {
  return {
    kind,
    element,
    contentRoot,
    metrics: () => metricsFor(element, kind === "document"),
    setTop: (top) => {
      const documentSurface = kind === "document";
      const metrics = metricsFor(element, documentSurface);
      const maximum = Math.max(0, metrics.height - metrics.viewport);
      const boundedTop = Math.min(maximum, Math.max(0, top));
      if (!documentSurface) {
        element.scrollTop = boundedTop;
        return;
      }

      /*
       * LinkedIn has used different document scrollers across browser builds.
       * Update every standards/quirks-mode candidate and the window API so a
       * stale body/documentElement reference cannot leave the page at the end.
       */
      for (const candidate of documentScrollElements(element.ownerDocument)) {
        try {
          candidate.scrollTop = boundedTop;
        } catch {
          // A read-only candidate does not prevent the remaining fallbacks.
        }
      }
      const view = element.ownerDocument.defaultView;
      if (view && typeof view.scrollTo === "function") {
        try {
          view.scrollTo({ top: boundedTop, left: 0, behavior: "auto" });
        } catch {
          try {
            view.scrollTo(0, boundedTop);
          } catch {
            // Direct scrollTop assignments above remain the final fallback.
          }
        }
      }
    },
    isConnected: () => element.isConnected && contentRoot.isConnected,
  };
}

/** Finds the profile's main scroller, never a chat/sidebar scroller. */
export function findProfileScrollSurface(document: Document): ScrollSurface | null {
  const contentRoot = findProfileContentRoot(document);
  const fallbackRoot = document.body ?? document.documentElement;
  const root = contentRoot ?? fallbackRoot;
  if (!root) return null;

  if (contentRoot) {
    for (
      let current: HTMLElement | null = contentRoot;
      current && current !== document.body && current !== document.documentElement;
      current = current.parentElement
    ) {
      if (!isExcluded(current) && canElementScroll(current)) {
        return createSurface(current, contentRoot, "element");
      }
    }
  }

  const scrollingElement = document.scrollingElement as HTMLElement | null;
  const documentScroller = scrollingElement ?? document.documentElement ?? document.body;
  return documentScroller ? createSurface(documentScroller, root, "document") : null;
}

export function isAtSurfaceBottom(surface: ScrollSurface, tolerance = 4): boolean {
  const { top, height, viewport } = surface.metrics();
  return top + viewport >= height - tolerance;
}

export function hasVisibleBusyIndicator(surface: ScrollSurface): boolean {
  const candidates = [
    ...(surface.contentRoot.matches(BUSY_SELECTOR) ? [surface.contentRoot] : []),
    ...surface.contentRoot.querySelectorAll<HTMLElement>(BUSY_SELECTOR),
  ];
  return candidates.some((candidate) => isElementRendered(candidate));
}

function waitForTopCheck(intervalMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(
      new DOMException("Returning to the top was cancelled.", "AbortError")
    );
  }
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, intervalMs);
    const onAbort = (): void => {
      globalThis.clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Returning to the top was cancelled.", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Reasserts the top until it remains stable. LinkedIn can restore an earlier
 * offset after lazy content or native-dialog focus cleanup has settled.
 */
export async function returnSurfaceToTop(
  surface: ScrollSurface,
  options: ReturnSurfaceToTopOptions = {}
): Promise<boolean> {
  const intervalMs = options.intervalMs ?? 50;
  const requiredStableChecks = options.requiredStableChecks ?? 16;
  const maximumChecks = options.maximumChecks ?? 60;
  let stableChecks = 0;

  for (let attempt = 0; attempt < maximumChecks; attempt += 1) {
    if (options.signal?.aborted) {
      throw new DOMException("Returning to the top was cancelled.", "AbortError");
    }
    if (!surface.isConnected()) return false;
    surface.setTop(0);
    await waitForTopCheck(intervalMs, options.signal);
    if (!surface.isConnected()) return false;
    if (surface.metrics().top <= 4) {
      stableChecks += 1;
      if (stableChecks >= requiredStableChecks) return true;
    } else {
      stableChecks = 0;
    }
  }
  return false;
}
