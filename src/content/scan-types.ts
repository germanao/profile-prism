export type ScanPhase =
  | "available"
  | "scanning"
  | "complete"
  | "partial"
  | "cancelled"
  | "failed";

export type ScanOverlayStage =
  | "preparing"
  | "verification"
  | "reading"
  | "settling"
  | "returning";

export type ScanStopReason =
  | "user-cancelled"
  | "user-interaction"
  | "page-hidden"
  | "route-changed"
  | "disabled"
  | "teardown"
  | "surface-replaced"
  | "timeout"
  | "step-limit"
  | "verification-unreadable"
  | "extractor-error"
  | "no-route"
  | "no-scroll-surface"
  | "return-to-top-failed";

export interface ScanPresentationState {
  phase: ScanPhase;
  stage: ScanOverlayStage;
  /** Current route equality key. It remains in memory and is never persisted. */
  routeKey: string | null;
  iterations: number;
  scrollSteps: number;
  atBottom: boolean;
  verificationInspected: boolean;
  elapsedMs: number;
  reason?: ScanStopReason;
}

export type ScanProgressSource =
  | "route"
  | "initial"
  | "verification"
  | "stage"
  | "scroll"
  | "returning"
  | "completion"
  | "cancellation"
  | "failure";

export interface ScanProgress<Evidence extends object> {
  state: ScanPresentationState;
  evidence: Readonly<Evidence> | null;
  source: ScanProgressSource;
}

export interface ScanOutcome<Evidence extends object> {
  state: ScanPresentationState;
  evidence: Readonly<Evidence> | null;
}

export type NativeVerificationInspection<Evidence extends object> =
  | { status: "not-present" }
  | { status: "inspected"; evidence?: Partial<Evidence> }
  | { status: "unreadable"; evidence?: Partial<Evidence> };

export interface NativeVerificationInspectionContext {
  document: Document;
  signal: AbortSignal;
}

export type NativeVerificationInspector<Evidence extends object> = (
  context: NativeVerificationInspectionContext,
) => Promise<NativeVerificationInspection<Evidence>>;

export interface ScanSettleContext {
  root: HTMLElement;
  signal: AbortSignal;
  quietMs: number;
  maxWaitMs: number;
  final: boolean;
}

export interface ScanSettleResult {
  /** True when mutations continued until the bounded wait expired. */
  timedOut: boolean;
  mutationCount: number;
}

export type ScanSettle = (
  context: ScanSettleContext,
) => Promise<ScanSettleResult>;
