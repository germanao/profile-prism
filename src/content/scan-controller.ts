import { RouteEvidenceAccumulator } from "./evidence-accumulator";
import {
  findProfileScrollSurface,
  hasVisibleBusyIndicator,
  isAtSurfaceBottom,
  returnSurfaceToTop,
  type ScrollSurface,
} from "./scroll-surface";
import type {
  NativeVerificationInspector,
  ScanOutcome,
  ScanPhase,
  ScanPresentationState,
  ScanProgress,
  ScanProgressSource,
  ScanSettle,
  ScanSettleResult,
  ScanStopReason,
} from "./scan-types";

const DEFAULT_MAX_DURATION_MS = 20_000;
const DEFAULT_MAX_STEPS = 40;
const DEFAULT_QUIET_MS = 300;
const DEFAULT_FINAL_QUIET_MS = 800;
const DEFAULT_SETTLE_CAP_MS = 1_500;
const OWNED_UI_SELECTOR = [
  "[data-profile-authenticity-host]",
  "[data-profile-authenticity-fab]",
  "[data-profile-authenticity-overlay]",
  "[data-profile-authenticity-scan-overlay]",
].join(", ");
const SCAN_UI_SELECTOR = [
  "[data-profile-authenticity-fab]",
  "[data-profile-authenticity-overlay='profile-evidence-details']",
  "[data-profile-authenticity-scan-overlay='full-profile-progress']",
].join(", ");
const SCROLL_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "PageDown",
  "PageUp",
  "Home",
  "End",
  " ",
  "Spacebar",
]);

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

export interface ScanTimer {
  setTimeout(callback: () => void, delayMs: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export interface FullProfileScanControllerOptions<Evidence extends object> {
  document?: Document;
  extractEvidence: () => Evidence;
  inspectNativeVerification?: NativeVerificationInspector<Evidence>;
  onProgress?: (progress: ScanProgress<Evidence>) => void;
  findScrollSurface?: (document: Document) => ScrollSurface | null;
  settle?: ScanSettle;
  isBusy?: (surface: ScrollSurface) => boolean;
  now?: () => number;
  timer?: ScanTimer;
  maxDurationMs?: number;
  maxSteps?: number;
  quietMs?: number;
  finalQuietMs?: number;
  settleCapMs?: number;
  isTrustedUserEvent?: (event: Event) => boolean;
  isScanUiEvent?: (event: Event) => boolean;
  returnToTop?: (surface: ScrollSurface, signal: AbortSignal) => Promise<boolean>;
}

function abortError(): DOMException {
  return new DOMException("The profile scan was cancelled.", "AbortError");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    let finished = false;
    const onAbort = (): void => {
      if (finished) return;
      finished = true;
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => {
        if (finished) return;
        finished = true;
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        if (finished) return;
        finished = true;
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function extensionOwnedEvent(event: Event): boolean {
  return event.composedPath().some(
    (target) => target instanceof Element && target.closest(SCAN_UI_SELECTOR) !== null,
  );
}

function relevantMutation(record: MutationRecord): boolean {
  const target = record.target.nodeType === Node.ELEMENT_NODE
    ? record.target as Element
    : record.target.parentElement;
  return target?.closest(OWNED_UI_SELECTOR) === null;
}

/** Waits for a quiet DOM window, while retaining an independent hard cap. */
export function waitForMutationQuiet({
  root,
  signal,
  quietMs,
  maxWaitMs,
}: Parameters<ScanSettle>[0]): Promise<ScanSettleResult> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    let mutations = 0;
    let quietTimer: TimerHandle | undefined;
    let capTimer: TimerHandle | undefined;
    let settled = false;

    const cleanup = (): void => {
      observer.disconnect();
      if (quietTimer !== undefined) globalThis.clearTimeout(quietTimer);
      if (capTimer !== undefined) globalThis.clearTimeout(capTimer);
      signal.removeEventListener("abort", onAbort);
    };
    const finish = (timedOut: boolean): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ timedOut, mutationCount: mutations });
    };
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(abortError());
    };
    const scheduleQuiet = (): void => {
      if (quietTimer !== undefined) globalThis.clearTimeout(quietTimer);
      quietTimer = globalThis.setTimeout(() => finish(false), quietMs);
    };
    const observer = new MutationObserver((records) => {
      const count = records.filter(relevantMutation).length;
      if (count === 0) return;
      mutations += count;
      scheduleQuiet();
    });

    observer.observe(root, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    signal.addEventListener("abort", onAbort, { once: true });
    scheduleQuiet();
    capTimer = globalThis.setTimeout(() => finish(true), maxWaitMs);
  });
}

/** Reuses one subtree observer across all settle windows in a scan run. */
class PersistentMutationQuietMonitor {
  private readonly observer: MutationObserver;
  private mutationCount = 0;
  private onMutation: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.observer = new MutationObserver((records) => {
      const count = records.filter(relevantMutation).length;
      if (count === 0) return;
      this.mutationCount += count;
      this.onMutation?.();
    });
    this.observer.observe(root, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  wait(signal: AbortSignal, quietMs: number, maxWaitMs: number): Promise<ScanSettleResult> {
    throwIfAborted(signal);
    const startedAtCount = this.mutationCount;
    return new Promise((resolve, reject) => {
      let quietTimer: TimerHandle | undefined;
      let capTimer: TimerHandle | undefined;
      let settled = false;
      const cleanup = (): void => {
        if (quietTimer !== undefined) globalThis.clearTimeout(quietTimer);
        if (capTimer !== undefined) globalThis.clearTimeout(capTimer);
        signal.removeEventListener("abort", onAbort);
        if (this.onMutation === scheduleQuiet) this.onMutation = null;
      };
      const finish = (timedOut: boolean): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({
          timedOut,
          mutationCount: this.mutationCount - startedAtCount,
        });
      };
      const onAbort = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(abortError());
      };
      const scheduleQuiet = (): void => {
        if (quietTimer !== undefined) globalThis.clearTimeout(quietTimer);
        quietTimer = globalThis.setTimeout(() => finish(false), quietMs);
      };
      this.onMutation = scheduleQuiet;
      signal.addEventListener("abort", onAbort, { once: true });
      scheduleQuiet();
      capTimer = globalThis.setTimeout(() => finish(true), maxWaitMs);
    });
  }

  dispose(): void {
    this.onMutation = null;
    this.observer.disconnect();
  }
}

function stateWithReason(
  base: Omit<ScanPresentationState, "reason">,
  reason?: ScanStopReason,
): ScanPresentationState {
  return reason ? { ...base, reason } : base;
}

function cancellationPhase(reason: ScanStopReason): ScanPhase {
  return reason === "user-cancelled" ||
    reason === "user-interaction" ||
    reason === "page-hidden" ||
    reason === "route-changed" ||
    reason === "disabled" ||
    reason === "teardown"
    ? "cancelled"
    : "partial";
}

export class FullProfileScanController<Evidence extends object> {
  private readonly document: Document;
  private readonly options: FullProfileScanControllerOptions<Evidence>;
  private readonly accumulator = new RouteEvidenceAccumulator<Evidence>();
  private routeKey: string | null = null;
  private abortController: AbortController | null = null;
  private timeoutHandle: TimerHandle | null = null;
  private activePromise: Promise<ScanOutcome<Evidence>> | null = null;
  private lastEmittedEvidenceFingerprint: string | null = null;
  private runSequence = 0;
  private disposed = false;
  private state: ScanPresentationState = {
    phase: "available",
    stage: "preparing",
    routeKey: null,
    iterations: 0,
    scrollSteps: 0,
    atBottom: false,
    verificationInspected: false,
    elapsedMs: 0,
  };

  constructor(options: FullProfileScanControllerOptions<Evidence>) {
    this.options = options;
    this.document = options.document ?? document;
  }

  get presentationState(): ScanPresentationState {
    return { ...this.state };
  }

  get evidence(): Readonly<Partial<Evidence>> {
    return this.accumulator.snapshot(this.routeKey);
  }

  setRoute(routeKey: string | null): void {
    if (routeKey === this.routeKey) return;
    this.cancel("route-changed");
    this.removeCancellationListeners();
    this.clearHardTimeout();
    this.activePromise = null;
    this.abortController = null;
    this.runSequence += 1;
    this.routeKey = routeKey;
    this.accumulator.clear();
    this.lastEmittedEvidenceFingerprint = null;
    if (routeKey) this.accumulator.beginRoute(routeKey);
    this.state = {
      phase: "available",
      stage: "preparing",
      routeKey,
      iterations: 0,
      scrollSteps: 0,
      atBottom: false,
      verificationInspected: false,
      elapsedMs: 0,
    };
    this.emit("route");
  }

  /** A second activation while scanning is treated as the explicit Cancel action. */
  start(): Promise<ScanOutcome<Evidence>> {
    if (this.activePromise && this.state.phase === "scanning") {
      this.cancel("user-cancelled");
      return this.activePromise;
    }
    if (this.disposed || !this.routeKey) {
      const reason: ScanStopReason = this.disposed ? "teardown" : "no-route";
      this.state = stateWithReason({ ...this.state, phase: "failed" }, reason);
      this.emit("failure");
      return Promise.resolve(this.outcome());
    }

    const runId = ++this.runSequence;
    const routeKey = this.routeKey;
    const promise = this.execute(runId, routeKey).finally(() => {
      if (runId === this.runSequence) {
        this.activePromise = null;
        this.abortController = null;
        this.clearHardTimeout();
      }
    });
    this.activePromise = promise;
    return promise;
  }

  cancel(reason: ScanStopReason = "user-cancelled"): void {
    if (!this.abortController || this.abortController.signal.aborted) return;
    this.abortController.abort(reason);
  }

  disable(): void {
    this.cancel("disabled");
    this.accumulator.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancel("teardown");
    this.disposed = true;
    this.runSequence += 1;
    this.routeKey = null;
    this.accumulator.clear();
    this.state = stateWithReason({
      ...this.state,
      phase: "cancelled",
      routeKey: null,
    }, "teardown");
    this.clearHardTimeout();
    this.removeCancellationListeners();
  }

  private async execute(runId: number, routeKey: string): Promise<ScanOutcome<Evidence>> {
    const startedAt = this.now();
    const surface = (this.options.findScrollSurface ?? findProfileScrollSurface)(this.document);
    if (!surface) {
      return this.finish(runId, startedAt, "failed", "no-scroll-surface", "failure");
    }

    const abortController = new AbortController();
    this.abortController = abortController;
    const { signal } = abortController;
    this.installCancellationListeners();
    this.installHardTimeout(abortController);
    this.state = {
      phase: "scanning",
      stage: "preparing",
      routeKey,
      iterations: 0,
      scrollSteps: 0,
      atBottom: isAtSurfaceBottom(surface),
      verificationInspected: false,
      elapsedMs: 0,
    };

    try {
      this.accumulator.merge(routeKey, this.options.extractEvidence());
      this.emit("initial", runId);
    } catch {
      this.removeCancellationListeners();
      return this.finish(runId, startedAt, "failed", "extractor-error", "failure");
    }

    let verificationIncomplete = false;
    try {
      if (this.options.inspectNativeVerification) {
        this.state = { ...this.state, stage: "verification" };
        this.emit("stage", runId);
        const inspection = await abortable(
          this.options.inspectNativeVerification({
            document: this.document,
            signal,
          }),
          signal,
        );
        throwIfAborted(signal);
        if ("evidence" in inspection && inspection.evidence) {
          this.accumulator.merge(routeKey, inspection.evidence);
        }
        if (inspection.status === "inspected") {
          this.state = { ...this.state, verificationInspected: true };
        } else if (inspection.status === "unreadable") {
          verificationIncomplete = true;
        }
        this.emit("verification", runId);
      }
    } catch (error) {
      if (signal.aborted) {
        this.removeCancellationListeners();
        return this.finishAbort(runId, startedAt, signal.reason);
      }
      verificationIncomplete = true;
    }

    this.state = { ...this.state, stage: "reading" };
    this.emit("stage", runId);

    let previousHeight = surface.metrics().height;
    let stableBottomChecks = 0;
    const maxSteps = this.options.maxSteps ?? DEFAULT_MAX_STEPS;
    const persistentSettle = this.options.settle
      ? null
      : new PersistentMutationQuietMonitor(surface.contentRoot);

    try {
      for (let iteration = 1; iteration <= maxSteps; iteration += 1) {
        throwIfAborted(signal);
        if (this.elapsed(startedAt) >= (this.options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS)) {
          return this.finish(runId, startedAt, "partial", "timeout", "failure");
        }
        if (!surface.isConnected()) {
          return this.finish(runId, startedAt, "partial", "surface-replaced", "failure");
        }
        const before = surface.metrics();
        if (!isAtSurfaceBottom(surface)) {
          const maximumStep = Math.floor(before.viewport * 0.75);
          if (maximumStep <= 0) {
            return this.finish(runId, startedAt, "partial", "surface-replaced", "failure");
          }
          surface.setTop(Math.min(before.height - before.viewport, before.top + maximumStep));
          this.state = { ...this.state, scrollSteps: this.state.scrollSteps + 1 };
        }

        const settled = await this.settle(surface, signal, false, persistentSettle);
        throwIfAborted(signal);
        if (this.options.settle || settled.mutationCount > 0) {
          this.accumulator.merge(routeKey, this.options.extractEvidence());
        }
        const after = surface.metrics();
        const atBottom = isAtSurfaceBottom(surface);
        const busy = (this.options.isBusy ?? hasVisibleBusyIndicator)(surface);
        const heightStable = after.height === previousHeight;
        stableBottomChecks = atBottom && heightStable && !busy && !settled.timedOut
          ? stableBottomChecks + 1
          : 0;
        previousHeight = after.height;
        this.state = {
          ...this.state,
          iterations: iteration,
          atBottom,
          elapsedMs: this.elapsed(startedAt),
        };
        this.emit("scroll", runId);

        if (stableBottomChecks < 3) continue;

        const finalHeight = after.height;
        this.state = {
          ...this.state,
          stage: "settling",
          elapsedMs: this.elapsed(startedAt),
        };
        this.emit("stage", runId);
        const finalSettle = await this.settle(surface, signal, true, persistentSettle);
        throwIfAborted(signal);
        this.accumulator.merge(routeKey, this.options.extractEvidence());
        const finalMetrics = surface.metrics();
        const finalBusy = (this.options.isBusy ?? hasVisibleBusyIndicator)(surface);
        if (
          !finalSettle.timedOut &&
          isAtSurfaceBottom(surface) &&
          finalMetrics.height === finalHeight &&
          !finalBusy
        ) {
          if (verificationIncomplete) {
            return this.finish(
              runId,
              startedAt,
              "partial",
              "verification-unreadable",
              "completion",
            );
          }
          this.state = {
            ...this.state,
            stage: "returning",
            elapsedMs: this.elapsed(startedAt),
          };
          this.emit("returning", runId);
          const returnedToTop = await this.returnToTop(surface, signal);
          throwIfAborted(signal);
          return returnedToTop
            ? this.finish(runId, startedAt, "complete", undefined, "completion")
            : this.finish(
              runId,
              startedAt,
              "partial",
              "return-to-top-failed",
              "failure",
            );
        }
        previousHeight = finalMetrics.height;
        stableBottomChecks = 0;
      }
      return this.finish(runId, startedAt, "partial", "step-limit", "failure");
    } catch (error) {
      if (signal.aborted) return this.finishAbort(runId, startedAt, signal.reason);
      return this.finish(runId, startedAt, "partial", "extractor-error", "failure");
    } finally {
      persistentSettle?.dispose();
      this.removeCancellationListeners();
    }
  }

  private settle(
    surface: ScrollSurface,
    signal: AbortSignal,
    final: boolean,
    monitor: PersistentMutationQuietMonitor | null,
  ): Promise<ScanSettleResult> {
    const quietMs = final
      ? this.options.finalQuietMs ?? DEFAULT_FINAL_QUIET_MS
      : this.options.quietMs ?? DEFAULT_QUIET_MS;
    const maxWaitMs = this.options.settleCapMs ?? DEFAULT_SETTLE_CAP_MS;
    if (monitor) return abortable(monitor.wait(signal, quietMs, maxWaitMs), signal);
    const operation = (this.options.settle ?? waitForMutationQuiet)({
      root: surface.contentRoot,
      signal,
      quietMs,
      maxWaitMs,
      final,
    });
    return abortable(operation, signal);
  }

  private async returnToTop(surface: ScrollSurface, signal: AbortSignal): Promise<boolean> {
    if (this.options.returnToTop) {
      return abortable(this.options.returnToTop(surface, signal), signal);
    }

    return returnSurfaceToTop(surface, { signal });
  }

  private finishAbort(runId: number, startedAt: number, rawReason: unknown): ScanOutcome<Evidence> {
    const reason = typeof rawReason === "string"
      ? rawReason as ScanStopReason
      : "user-cancelled";
    return this.finish(runId, startedAt, cancellationPhase(reason), reason, "cancellation");
  }

  private finish(
    runId: number,
    startedAt: number,
    phase: ScanPhase,
    reason: ScanStopReason | undefined,
    source: ScanProgressSource,
  ): ScanOutcome<Evidence> {
    if (runId === this.runSequence) {
      this.state = stateWithReason({
        ...this.state,
        phase,
        elapsedMs: this.elapsed(startedAt),
      }, reason);
      this.emit(source, runId);
    }
    return this.outcome();
  }

  private emit(source: ScanProgressSource, runId = this.runSequence): void {
    if (runId !== this.runSequence) return;
    const fullEvidence = this.fullEvidence();
    const fingerprint = fullEvidence ? JSON.stringify(fullEvidence) : null;
    const includeEvidence =
      source === "completion" ||
      fingerprint !== this.lastEmittedEvidenceFingerprint;
    if (includeEvidence) this.lastEmittedEvidenceFingerprint = fingerprint;
    this.options.onProgress?.({
      state: { ...this.state },
      evidence: includeEvidence ? fullEvidence : null,
      source,
    });
  }

  private fullEvidence(): Readonly<Evidence> | null {
    const snapshot = this.accumulator.snapshot(this.routeKey);
    return Object.keys(snapshot).length > 0 ? snapshot as Readonly<Evidence> : null;
  }

  private outcome(): ScanOutcome<Evidence> {
    return { state: { ...this.state }, evidence: this.fullEvidence() };
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private elapsed(startedAt: number): number {
    return Math.max(0, this.now() - startedAt);
  }

  private installHardTimeout(controller: AbortController): void {
    const timer = this.options.timer ?? {
      setTimeout: (callback: () => void, delayMs: number) => globalThis.setTimeout(callback, delayMs),
      clearTimeout: (handle: TimerHandle) => globalThis.clearTimeout(handle),
    };
    this.timeoutHandle = timer.setTimeout(() => {
      if (!controller.signal.aborted) controller.abort("timeout");
    }, this.options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS);
  }

  private clearHardTimeout(): void {
    if (this.timeoutHandle === null) return;
    (this.options.timer ?? {
      setTimeout: (callback: () => void, delayMs: number) => globalThis.setTimeout(callback, delayMs),
      clearTimeout: (handle: TimerHandle) => globalThis.clearTimeout(handle),
    }).clearTimeout(this.timeoutHandle);
    this.timeoutHandle = null;
  }

  private readonly onPotentialUserInput = (event: Event): void => {
    if (!(this.options.isTrustedUserEvent ?? ((candidate) => candidate.isTrusted))(event)) return;
    // Escape is always the scan-level Cancel action, including when keyboard
    // focus is inside the FAB's shadow tree.
    if (event instanceof KeyboardEvent && event.key === "Escape") {
      this.cancel("user-interaction");
      return;
    }
    if ((this.options.isScanUiEvent ?? extensionOwnedEvent)(event)) return;
    if (event instanceof KeyboardEvent && !SCROLL_KEYS.has(event.key)) return;
    this.cancel("user-interaction");
  };

  private readonly onVisibilityChange = (): void => {
    if (this.document.hidden) this.cancel("page-hidden");
  };

  private installCancellationListeners(): void {
    this.document.addEventListener("wheel", this.onPotentialUserInput, true);
    this.document.addEventListener("touchstart", this.onPotentialUserInput, true);
    this.document.addEventListener("pointerdown", this.onPotentialUserInput, true);
    this.document.addEventListener("keydown", this.onPotentialUserInput, true);
    this.document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  private removeCancellationListeners(): void {
    this.document.removeEventListener("wheel", this.onPotentialUserInput, true);
    this.document.removeEventListener("touchstart", this.onPotentialUserInput, true);
    this.document.removeEventListener("pointerdown", this.onPotentialUserInput, true);
    this.document.removeEventListener("keydown", this.onPotentialUserInput, true);
    this.document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }
}

export type {
  NativeVerificationInspection,
  NativeVerificationInspector,
  ScanOutcome,
  ScanOverlayStage,
  ScanPhase,
  ScanPresentationState,
  ScanProgress,
  ScanSettle,
  ScanSettleResult,
  ScanStopReason,
} from "./scan-types";
