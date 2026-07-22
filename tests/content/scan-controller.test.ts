import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FullProfileScanController,
  waitForMutationQuiet,
  type ScanProgress,
} from "../../src/content/scan-controller";
import type { ScrollSurface } from "../../src/content/scroll-surface";
import {
  observedObservation,
  unavailableObservation,
  type Observation,
} from "../../src/scoring/evidence-schema";

interface TestEvidence {
  identity: Observation<"verified">;
  history: Observation<"rich">;
}

function evidence(
  identity: TestEvidence["identity"] = unavailableObservation("not-loaded"),
  history: TestEvidence["history"] = unavailableObservation("not-loaded"),
): TestEvidence {
  return { identity, history };
}

interface FakeSurfaceControl {
  surface: ScrollSurface;
  positions: number[];
  setHeight(height: number): void;
}

function fakeSurface({
  height = 1_000,
  viewport = 400,
  top = 0,
}: {
  height?: number;
  viewport?: number;
  top?: number;
} = {}): FakeSurfaceControl {
  let currentHeight = height;
  let currentTop = top;
  const positions: number[] = [];
  const root = document.createElement("main");
  document.body.append(root);
  return {
    positions,
    setHeight: (next) => { currentHeight = next; },
    surface: {
      kind: "element",
      element: root,
      contentRoot: root,
      metrics: () => ({ top: currentTop, height: currentHeight, viewport }),
      setTop: (next) => {
        currentTop = Math.min(currentHeight - viewport, Math.max(0, next));
        positions.push(currentTop);
      },
      isConnected: () => root.isConnected,
    },
  };
}

function noRealTimer() {
  return {
    setTimeout: () => 1 as unknown as ReturnType<typeof globalThis.setTimeout>,
    clearTimeout: () => undefined,
  };
}

describe("FullProfileScanController", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for a new quiet window after a relevant DOM mutation", async () => {
    vi.useFakeTimers();
    const root = document.createElement("main");
    document.body.append(root);
    const controller = new AbortController();
    const waiting = waitForMutationQuiet({
      root,
      signal: controller.signal,
      quietMs: 30,
      maxWaitMs: 100,
      final: false,
    });

    await vi.advanceTimersByTimeAsync(20);
    root.append(document.createElement("section"));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(30);

    await expect(waiting).resolves.toEqual({ timedOut: false, mutationCount: 1 });
  });

  it("scans in bounded steps, stabilizes at the bottom, and returns to the top before completion", async () => {
    const controlled = fakeSurface();
    const progress: Array<ScanProgress<TestEvidence>> = [];
    let settleCalls = 0;
    let extractionCalls = 0;
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => {
        extractionCalls += 1;
        return extractionCalls === 1
          ? evidence(observedObservation("verified", "top-card", 0.9))
          : evidence(
              unavailableObservation("top-card-replaced"),
              observedObservation("rich", "experience", 0.9),
            );
      },
      inspectNativeVerification: async () => ({
        status: "inspected",
        evidence: { identity: observedObservation("verified", "native-dialog") },
      }),
      settle: async () => {
        settleCalls += 1;
        if (settleCalls === 3) controlled.setHeight(1_400);
        return { timedOut: false, mutationCount: 0 };
      },
      timer: noRealTimer(),
      onProgress: (update) => progress.push(update),
    });
    controller.setRoute("profile-a");

    const result = await controller.start();

    expect(result.state.phase).toBe("complete");
    expect(result.state.verificationInspected).toBe(true);
    expect(result.evidence?.identity).toMatchObject({ state: "observed", value: "verified" });
    expect(result.evidence?.history).toMatchObject({ state: "observed", value: "rich" });
    expect(controlled.surface.metrics().top).toBe(0);
    expect(controlled.positions.length).toBeGreaterThan(0);
    expect(controlled.positions.every((position, index, values) => {
      const previous = values[index - 1] ?? 0;
      return position - previous <= 300;
    })).toBe(true);
    expect(progress.some(({ source }) => source === "verification")).toBe(true);
    expect(progress.some(({ source, state }) =>
      source === "returning" && state.stage === "returning"
    )).toBe(true);
    expect(progress.at(-1)?.state.phase).toBe("complete");
  });

  it("keeps the best evidence partial when returning to the top fails", async () => {
    const controlled = fakeSurface({ height: 800, viewport: 400 });
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(
        observedObservation("verified", "top-card", 0.9),
        observedObservation("rich", "experience", 0.9),
      ),
      settle: async () => ({ timedOut: false, mutationCount: 0 }),
      returnToTop: async () => false,
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");

    await expect(controller.start()).resolves.toMatchObject({
      state: {
        phase: "partial",
        stage: "returning",
        reason: "return-to-top-failed",
      },
      evidence: {
        identity: { state: "observed", value: "verified" },
        history: { state: "observed", value: "rich" },
      },
    });
    expect(controlled.surface.metrics().top).toBe(400);
  });

  it("reasserts the top when the page asynchronously restores its old position", async () => {
    vi.useFakeTimers();
    const controlled = fakeSurface({ height: 800, viewport: 400 });
    const originalSetTop = controlled.surface.setTop.bind(controlled.surface);
    let restoredOnce = false;
    controlled.surface.setTop = (next) => {
      originalSetTop(next);
      if (
        next === 0 &&
        !restoredOnce &&
        controlled.positions.some((position) => position > 0)
      ) {
        restoredOnce = true;
        globalThis.setTimeout(() => originalSetTop(240), 75);
      }
    };
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(
        observedObservation("verified", "top-card", 0.9),
        observedObservation("rich", "experience", 0.9),
      ),
      settle: async () => ({ timedOut: false, mutationCount: 0 }),
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");

    const scan = controller.start();
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(scan).resolves.toMatchObject({ state: { phase: "complete" } });
    expect(restoredOnce).toBe(true);
    expect(controlled.surface.metrics().top).toBe(0);
    const reboundIndex = controlled.positions.indexOf(240);
    expect(reboundIndex).toBeGreaterThan(0);
    expect(controlled.positions.slice(reboundIndex + 1)).toContain(0);
  });

  it("cancels an active scan through the public API", async () => {
    const controlled = fakeSurface();
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(),
      settle: ({ signal }) => new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), { once: true });
      }),
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");
    const scan = controller.start();
    await Promise.resolve();
    controller.cancel();

    await expect(scan).resolves.toMatchObject({
      state: { phase: "cancelled", reason: "user-cancelled" },
    });
  });

  it("treats a second start activation as Cancel and retains the best route evidence", async () => {
    const controlled = fakeSurface();
    let abortReason: unknown;
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(observedObservation("verified", "top-card", 0.9)),
      settle: ({ signal }) => new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          abortReason = signal.reason;
          reject(new DOMException("cancelled", "AbortError"));
        }, { once: true });
      }),
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");

    const firstActivation = controller.start();
    await Promise.resolve();
    const secondActivation = controller.start();

    expect(secondActivation).toBe(firstActivation);
    const result = await secondActivation;
    expect(abortReason).toBe("user-cancelled");
    expect(result.state).toMatchObject({
      phase: "cancelled",
      reason: "user-cancelled",
      routeKey: "profile-a",
    });
    expect(result.evidence?.identity).toMatchObject({ state: "observed", value: "verified" });
    expect(controller.evidence.identity).toMatchObject({ state: "observed", value: "verified" });
  });

  it("cancels on trusted interaction outside extension UI", async () => {
    const controlled = fakeSurface();
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(),
      settle: ({ signal }) => new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), { once: true });
      }),
      isTrustedUserEvent: () => true,
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");
    const scan = controller.start();
    await Promise.resolve();
    document.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));

    await expect(scan).resolves.toMatchObject({
      state: { phase: "cancelled", reason: "user-interaction" },
    });
  });

  it("cancels on a trusted touch interaction outside the FAB and retains known evidence", async () => {
    const controlled = fakeSurface();
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(observedObservation("verified", "top-card", 0.9)),
      settle: ({ signal }) => new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("touch", "AbortError")), { once: true });
      }),
      isTrustedUserEvent: () => true,
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");
    const scan = controller.start();
    await Promise.resolve();

    document.body.dispatchEvent(new Event("touchstart", { bubbles: true, composed: true }));

    const result = await scan;
    expect(result.state).toMatchObject({ phase: "cancelled", reason: "user-interaction" });
    expect(result.evidence?.identity).toMatchObject({ state: "observed", value: "verified" });
  });

  it("cancels on a trusted keyboard-scroll command outside the FAB", async () => {
    const controlled = fakeSurface();
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(observedObservation("verified", "top-card", 0.9)),
      settle: ({ signal }) => new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("keyboard", "AbortError")), { once: true });
      }),
      isTrustedUserEvent: () => true,
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");
    const scan = controller.start();
    await Promise.resolve();

    document.body.dispatchEvent(new KeyboardEvent("keydown", {
      key: "PageDown",
      bubbles: true,
      composed: true,
    }));

    const result = await scan;
    expect(result.state).toMatchObject({ phase: "cancelled", reason: "user-interaction" });
    expect(result.evidence?.identity).toMatchObject({ state: "observed", value: "verified" });
  });

  it("cancels on a trusted pointer interaction outside the FAB", async () => {
    const controlled = fakeSurface();
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(observedObservation("verified", "top-card", 0.9)),
      settle: ({ signal }) => new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("pointer", "AbortError")), { once: true });
      }),
      isTrustedUserEvent: () => true,
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");
    const scan = controller.start();
    await Promise.resolve();

    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));

    const result = await scan;
    expect(result.state).toMatchObject({ phase: "cancelled", reason: "user-interaction" });
    expect(result.evidence?.identity).toMatchObject({ state: "observed", value: "verified" });
  });

  it("lets Escape cancel even when focus is inside extension-owned Shadow DOM", async () => {
    const controlled = fakeSurface();
    const host = document.createElement("div");
    host.setAttribute("data-profile-authenticity-host", "fab");
    const shadow = host.attachShadow({ mode: "open" });
    const button = document.createElement("button");
    shadow.append(button);
    document.body.append(host);
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(),
      settle: ({ signal }) => new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), { once: true });
      }),
      isTrustedUserEvent: () => true,
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");
    const scan = controller.start();
    await Promise.resolve();
    button.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      composed: true,
    }));

    await expect(scan).resolves.toMatchObject({
      state: { phase: "cancelled", reason: "user-interaction" },
    });
  });

  it("does not treat an ordinary FAB pointer event as outside-user interaction", async () => {
    const controlled = fakeSurface();
    const host = document.createElement("aside");
    host.setAttribute("data-profile-authenticity-fab", "visible-profile-scan");
    const shadow = host.attachShadow({ mode: "open" });
    const button = document.createElement("button");
    shadow.append(button);
    document.body.append(host);
    let release: (() => void) | undefined;
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(),
      settle: ({ signal }) => new Promise((resolve, reject) => {
        release = () => resolve({ timedOut: false, mutationCount: 0 });
        signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), { once: true });
      }),
      isTrustedUserEvent: () => true,
      maxSteps: 1,
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");
    const scan = controller.start();
    await Promise.resolve();
    button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    expect(controller.presentationState.phase).toBe("scanning");
    release?.();

    await expect(scan).resolves.toMatchObject({ state: { phase: "partial", reason: "step-limit" } });
  });

  it("returns a bounded partial result at the step limit", async () => {
    const controlled = fakeSurface({ height: 100_000, viewport: 400 });
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(),
      settle: async () => ({ timedOut: false, mutationCount: 0 }),
      maxSteps: 2,
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");

    const result = await controller.start();
    expect(result.state).toMatchObject({ phase: "partial", reason: "step-limit", iterations: 2 });
    expect(controlled.positions).toHaveLength(2);
  });

  it("uses the injected clock to enforce timeout without a real wait", async () => {
    const controlled = fakeSurface({ height: 10_000, viewport: 400 });
    let now = 0;
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(),
      settle: async () => {
        now += 21;
        return { timedOut: false, mutationCount: 0 };
      },
      now: () => now,
      maxDurationMs: 20,
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");

    await expect(controller.start()).resolves.toMatchObject({
      state: { phase: "partial", reason: "timeout" },
    });
  });

  it("marks an otherwise complete scroll partial when verification is unreadable", async () => {
    const controlled = fakeSurface({ height: 400, viewport: 400 });
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(),
      inspectNativeVerification: async () => ({ status: "unreadable" }),
      settle: async () => ({ timedOut: false, mutationCount: 0 }),
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");

    await expect(controller.start()).resolves.toMatchObject({
      state: { phase: "partial", reason: "verification-unreadable", atBottom: true },
    });
  });

  it("fails without extraction when no profile scroll surface is available", async () => {
    const extractEvidence = vi.fn(() => evidence(observedObservation("verified", "top-card")));
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => null,
      extractEvidence,
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");

    const result = await controller.start();

    expect(result.state).toMatchObject({
      phase: "failed",
      reason: "no-scroll-surface",
      routeKey: "profile-a",
    });
    expect(result.evidence).toBeNull();
    expect(extractEvidence).not.toHaveBeenCalled();
  });

  it("fails atomically when the initial extraction throws", async () => {
    const controlled = fakeSurface();
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => {
        throw new Error("initial extractor failure");
      },
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");

    const result = await controller.start();

    expect(result.state).toMatchObject({
      phase: "failed",
      reason: "extractor-error",
      routeKey: "profile-a",
    });
    expect(result.evidence).toBeNull();
  });

  it("returns a partial result with prior evidence when a later extraction throws", async () => {
    const controlled = fakeSurface();
    let extractionCalls = 0;
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => {
        extractionCalls += 1;
        if (extractionCalls > 1) throw new Error("progressive extractor failure");
        return evidence(observedObservation("verified", "top-card", 0.9));
      },
      settle: async () => ({ timedOut: false, mutationCount: 0 }),
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");

    const result = await controller.start();

    expect(result.state).toMatchObject({
      phase: "partial",
      reason: "extractor-error",
      routeKey: "profile-a",
    });
    expect(result.evidence?.identity).toMatchObject({ state: "observed", value: "verified" });
    expect(controller.evidence.identity).toMatchObject({ state: "observed", value: "verified" });
  });

  it("cancels when the document becomes hidden and retains evidence gathered before hiding", async () => {
    const controlled = fakeSurface();
    let hidden = false;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(observedObservation("verified", "top-card", 0.9)),
      settle: ({ signal }) => new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("hidden", "AbortError")), { once: true });
      }),
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");
    const scan = controller.start();
    await Promise.resolve();

    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));

    const result = await scan;
    expect(result.state).toMatchObject({
      phase: "cancelled",
      reason: "page-hidden",
      routeKey: "profile-a",
    });
    expect(result.evidence?.identity).toMatchObject({ state: "observed", value: "verified" });
    expect(controller.evidence.identity).toMatchObject({ state: "observed", value: "verified" });
  });

  it("returns a partial result with the best evidence when the scroll container is replaced", async () => {
    const original = fakeSurface();
    fakeSurface();
    let settleCalls = 0;
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => original.surface,
      extractEvidence: () => evidence(
        observedObservation("verified", "top-card", 0.9),
        observedObservation("rich", "experience", 0.9),
      ),
      settle: async () => {
        settleCalls += 1;
        if (settleCalls === 1) original.surface.element.remove();
        return { timedOut: false, mutationCount: 1 };
      },
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");

    const result = await controller.start();

    expect(result.state).toMatchObject({
      phase: "partial",
      reason: "surface-replaced",
      routeKey: "profile-a",
    });
    expect(result.evidence).toMatchObject({
      identity: { state: "observed", value: "verified" },
      history: { state: "observed", value: "rich" },
    });
    expect(controller.evidence).toMatchObject(result.evidence ?? {});

    controller.setRoute("profile-b");
    expect(controller.presentationState).toMatchObject({ phase: "available", routeKey: "profile-b" });
    expect(controller.evidence).toEqual({});
  });

  it("cancels on disablement and clears previously accumulated route evidence", async () => {
    const controlled = fakeSurface();
    let abortReason: unknown;
    const progress: Array<ScanProgress<TestEvidence>> = [];
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(observedObservation("verified", "top-card", 0.9)),
      settle: ({ signal }) => new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          abortReason = signal.reason;
          reject(new DOMException("disabled", "AbortError"));
        }, { once: true });
      }),
      onProgress: (update) => progress.push(update),
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");
    const scan = controller.start();
    await Promise.resolve();
    expect(progress.some(({ source, evidence: current }) =>
      source === "initial" && current?.identity.state === "observed"
    )).toBe(true);

    controller.disable();

    const result = await scan;
    expect(abortReason).toBe("disabled");
    expect(result.state).toMatchObject({
      phase: "cancelled",
      reason: "disabled",
      routeKey: "profile-a",
    });
    expect(result.evidence).toBeNull();
    expect(controller.evidence).toEqual({});
  });

  it("aborts the stale run and isolates state when navigation replaces the route", async () => {
    const controlled = fakeSurface();
    let abortReason: unknown;
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(observedObservation("verified", "profile-a")),
      settle: ({ signal }) => new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          abortReason = signal.reason;
          reject(new DOMException("route changed", "AbortError"));
        }, { once: true });
      }),
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");
    const firstScan = controller.start();
    await Promise.resolve();
    controller.setRoute("profile-b");

    const staleOutcome = await firstScan;
    expect(abortReason).toBe("route-changed");
    expect(staleOutcome.state).toMatchObject({ phase: "available", routeKey: "profile-b" });
    expect(staleOutcome.state).not.toHaveProperty("reason");
    expect(staleOutcome.evidence).toBeNull();
    expect(controller.presentationState).toMatchObject({ phase: "available", routeKey: "profile-b" });
    expect(controller.evidence).toEqual({});
  });

  it("cancels teardown with an explicit terminal state and clears all route-local evidence", async () => {
    const controlled = fakeSurface();
    let abortReason: unknown;
    const controller = new FullProfileScanController<TestEvidence>({
      document,
      findScrollSurface: () => controlled.surface,
      extractEvidence: () => evidence(observedObservation("verified", "top-card", 0.9)),
      settle: ({ signal }) => new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          abortReason = signal.reason;
          reject(new DOMException("teardown", "AbortError"));
        }, { once: true });
      }),
      timer: noRealTimer(),
    });
    controller.setRoute("profile-a");
    const scan = controller.start();
    await Promise.resolve();

    controller.dispose();

    const result = await scan;
    expect(abortReason).toBe("teardown");
    expect(result.state).toMatchObject({
      phase: "cancelled",
      reason: "teardown",
      routeKey: null,
    });
    expect(result.evidence).toBeNull();
    expect(controller.presentationState).toMatchObject({
      phase: "cancelled",
      reason: "teardown",
      routeKey: null,
    });
    expect(controller.evidence).toEqual({});

    await expect(controller.start()).resolves.toMatchObject({
      state: { phase: "failed", reason: "teardown", routeKey: null },
      evidence: null,
    });
  });
});
