export interface ProfileRoute {
  /** Used for in-memory equality only. It is never persisted or messaged. */
  key: string;
  url: URL;
}

export type RouteEvent =
  | { kind: "route-changed"; route: ProfileRoute | null }
  | { kind: "visible-dom-changed"; route: ProfileRoute }
  | { kind: "badge-mount-invalidated"; route: ProfileRoute };

export type RouteEventListener = (event: RouteEvent) => void;

const DEFAULT_DEBOUNCE_MS = 350;
const DEFAULT_MAX_WAIT_MS = 1_500;
const URL_POLL_MS = 2_000;
const OWNED_HOST_SELECTOR = "[data-profile-authenticity-host]";
const BADGE_HOST_SELECTOR =
  '[data-profile-authenticity-host="profile-evidence-badge"]';
const IGNORED_DYNAMIC_REGION_SELECTOR = [
  "nav",
  "[role='navigation']",
  "aside",
  "[role='complementary']",
  "[class*='msg-overlay']",
  "[class*='messaging']",
  "[id*='messaging']",
  "[aria-label*='messaging' i]",
  "[aria-label*='chat' i]"
].join(", ");

export function parseProfileRoute(value: string | URL): ProfileRoute | null {
  let url: URL;
  try {
    url = value instanceof URL ? new URL(value.href) : new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "www.linkedin.com") {
    return null;
  }

  const match = /^\/in\/([^/]+)\/?$/.exec(url.pathname);
  const encodedProfileId = match?.[1];
  if (!encodedProfileId) {
    return null;
  }

  let profileId: string;
  try {
    profileId = decodeURIComponent(encodedProfileId).normalize("NFC").trim();
  } catch {
    return null;
  }
  if (!profileId || profileId === "." || profileId === "..") {
    return null;
  }

  const normalizedPath = `/in/${encodeURIComponent(profileId)}/`;
  const normalizedUrl = new URL(normalizedPath, "https://www.linkedin.com");
  return {
    key: normalizedUrl.href,
    url: normalizedUrl
  };
}

function isExtensionOwnedNode(node: Node): boolean {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  return element?.closest(OWNED_HOST_SELECTOR) != null;
}

function nodeContainsBadgeHost(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  const element = node as Element;
  return (
    element.matches(BADGE_HOST_SELECTOR) ||
    element.querySelector(BADGE_HOST_SELECTOR) !== null
  );
}

function isIgnoredDynamicNode(node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE
    ? node as Element
    : node.parentElement;
  return element?.closest(IGNORED_DYNAMIC_REGION_SELECTOR) != null;
}

function profileContentRoot(document: Document): Element | null {
  return document.querySelector("main, [role='main']");
}

function includesRelevantVisibleMutation(records: MutationRecord[]): boolean {
  return records.some((record) => {
    if (isExtensionOwnedNode(record.target) || isIgnoredDynamicNode(record.target)) {
      return false;
    }

    if (record.type === "characterData" || record.type === "attributes") return true;

    if (record.addedNodes.length === 0 && record.removedNodes.length === 0) {
      return false;
    }

    return [...record.addedNodes, ...record.removedNodes].some(
      (node) => !isExtensionOwnedNode(node) && !isIgnoredDynamicNode(node)
    );
  });
}

function includesRemovedBadge(records: MutationRecord[]): boolean {
  return records.some(
    (record) =>
      record.type === "childList" &&
      [...record.removedNodes].some(nodeContainsBadgeHost)
  );
}

/**
 * Coordinates LinkedIn's SPA route changes and lazy-rendered DOM with one
 * debounced observer. This observer itself never scrolls, clicks, expands,
 * fetches, or navigates; the separate scan coordinator may scroll only after
 * an explicit user action.
 */
export class RouteCoordinator {
  private readonly listener: RouteEventListener;
  private readonly debounceMs: number;
  private readonly maxWaitMs: number;
  private readonly document: Document;
  private readonly location: Location;
  private shellObserver: MutationObserver | null = null;
  private profileObserver: MutationObserver | null = null;
  private profileRoot: Element | null = null;
  private quietTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  private maxTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  private routeTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  private badgeRepairQueued = false;
  private urlPoll: ReturnType<typeof globalThis.setInterval> | undefined;
  private route: ProfileRoute | null = null;
  private started = false;

  constructor(
    listener: RouteEventListener,
    options: {
      debounceMs?: number;
      maxWaitMs?: number;
      document?: Document;
      location?: Location;
    } = {}
  ) {
    this.listener = listener;
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
    this.document = options.document ?? document;
    this.location = options.location ?? location;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.route = parseProfileRoute(this.location.href);
    this.listener({ kind: "route-changed", route: this.route });

    /*
     * The shell observer is deliberately limited to child-list changes. It
     * survives LinkedIn replacing <body>/<main> and detects SPA navigation,
     * while profile text and attribute traffic is handled by the scoped
     * observer below.
     */
    const target = this.document.documentElement ?? this.document;
    if (target) {
      this.shellObserver = new MutationObserver(() => {
        const nextRoute = parseProfileRoute(this.location.href);
        if (nextRoute?.key !== this.route?.key) {
          this.scheduleRouteCheck();
          return;
        }
        if (nextRoute && this.syncProfileObserver()) {
          this.scheduleVisibleRefresh();
        }
      });
      this.shellObserver.observe(target, {
        childList: true,
        subtree: true
      });
    }
    this.syncProfileObserver();

    globalThis.addEventListener("popstate", this.onNavigation);
    globalThis.addEventListener("hashchange", this.onNavigation);
    this.document.addEventListener("visibilitychange", this.onVisibilityChange);
    // pushState does not emit a standard event, and patching page history from
    // an isolated extension world is unreliable. This route-only poll performs
    // no DOM scan and closes the rare no-mutation SPA navigation gap.
    this.urlPoll = globalThis.setInterval(() => {
      if (!this.started || this.document.hidden) {
        return;
      }
      const nextRoute = parseProfileRoute(this.location.href);
      if (nextRoute?.key !== this.route?.key) {
        this.applyRoute(nextRoute);
      }
    }, URL_POLL_MS);
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.shellObserver?.disconnect();
    this.shellObserver = null;
    this.disconnectProfileObserver();
    this.clearRefreshTimers();
    if (this.routeTimer !== undefined) globalThis.clearTimeout(this.routeTimer);
    this.routeTimer = undefined;
    if (this.urlPoll !== undefined) {
      globalThis.clearInterval(this.urlPoll);
      this.urlPoll = undefined;
    }
    globalThis.removeEventListener("popstate", this.onNavigation);
    globalThis.removeEventListener("hashchange", this.onNavigation);
    this.document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.route = null;
  }

  checkNow(): void {
    if (!this.started) {
      return;
    }
    const nextRoute = parseProfileRoute(this.location.href);
    if (nextRoute?.key !== this.route?.key) {
      this.applyRoute(nextRoute);
      return;
    }
    if (nextRoute) {
      this.listener({ kind: "visible-dom-changed", route: nextRoute });
    }
  }

  private readonly onNavigation = (): void => {
    this.scheduleRouteCheck();
  };

  private readonly onVisibilityChange = (): void => {
    if (!this.started) return;
    if (this.document.hidden) {
      this.disconnectProfileObserver();
      this.clearRefreshTimers();
      return;
    }
    const nextRoute = parseProfileRoute(this.location.href);
    if (nextRoute?.key !== this.route?.key) {
      this.applyRoute(nextRoute);
      return;
    }
    this.syncProfileObserver();
    if (nextRoute) this.scheduleVisibleRefresh();
  };

  /** Returns true when LinkedIn replaced the observed profile root. */
  private syncProfileObserver(): boolean {
    const nextRoot = this.route && !this.document.hidden
      ? profileContentRoot(this.document)
      : null;
    if (nextRoot === this.profileRoot && this.profileObserver) return false;
    if (nextRoot === this.profileRoot && nextRoot === null) return false;

    this.disconnectProfileObserver();
    if (!nextRoot) return true;
    this.profileRoot = nextRoot;
    this.profileObserver = new MutationObserver((records) => {
      if (!this.started || !this.route || this.document.hidden) return;
      if (includesRemovedBadge(records)) this.scheduleBadgeRepair();
      if (includesRelevantVisibleMutation(records)) this.scheduleVisibleRefresh();
    });
    this.profileObserver.observe(nextRoot, {
      attributes: true,
      attributeFilter: ["aria-label", "aria-hidden", "hidden", "href", "src", "title"],
      childList: true,
      subtree: true,
      characterData: true
    });
    return true;
  }

  private disconnectProfileObserver(): void {
    this.profileObserver?.disconnect();
    this.profileObserver = null;
    this.profileRoot = null;
  }

  private scheduleBadgeRepair(): void {
    if (this.badgeRepairQueued) return;
    this.badgeRepairQueued = true;
    queueMicrotask(() => {
      this.badgeRepairQueued = false;
      if (this.started && this.route) {
        this.listener({ kind: "badge-mount-invalidated", route: this.route });
      }
    });
  }

  private scheduleVisibleRefresh(): void {
    if (!this.started || !this.route || this.document.hidden) return;
    if (this.quietTimer !== undefined) globalThis.clearTimeout(this.quietTimer);
    this.quietTimer = globalThis.setTimeout(() => this.flushVisibleRefresh(), this.debounceMs);
    this.maxTimer ??= globalThis.setTimeout(() => this.flushVisibleRefresh(), this.maxWaitMs);
  }

  private flushVisibleRefresh(): void {
    this.clearRefreshTimers();
    if (!this.started || !this.route || this.document.hidden) return;
    const nextRoute = parseProfileRoute(this.location.href);
    if (nextRoute?.key !== this.route.key) {
      this.applyRoute(nextRoute);
      return;
    }
    this.listener({ kind: "visible-dom-changed", route: this.route });
  }

  private clearRefreshTimers(): void {
    if (this.quietTimer !== undefined) globalThis.clearTimeout(this.quietTimer);
    if (this.maxTimer !== undefined) globalThis.clearTimeout(this.maxTimer);
    this.quietTimer = undefined;
    this.maxTimer = undefined;
  }

  private scheduleRouteCheck(): void {
    if (this.routeTimer !== undefined) return;
    this.routeTimer = globalThis.setTimeout(() => {
      this.routeTimer = undefined;
      if (!this.started) return;
      const nextRoute = parseProfileRoute(this.location.href);
      if (nextRoute?.key !== this.route?.key) this.applyRoute(nextRoute);
    }, 0);
  }

  private applyRoute(nextRoute: ProfileRoute | null): void {
    this.clearRefreshTimers();
    this.route = nextRoute;
    this.syncProfileObserver();
    this.listener({ kind: "route-changed", route: nextRoute });
  }
}
