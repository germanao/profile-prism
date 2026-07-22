import type { ScoreResult } from "../scoring";
import type { ScanPhase, ScanStopReason } from "../content/scan-types";

export const GET_CURRENT_SCORE_MESSAGE =
  "profile-authenticity:get-current-score" as const;
export const REFRESH_CURRENT_SCORE_MESSAGE =
  "profile-authenticity:refresh-current-score" as const;

export interface GetCurrentScoreMessage {
  type: typeof GET_CURRENT_SCORE_MESSAGE;
}

export interface RefreshCurrentScoreMessage {
  type: typeof REFRESH_CURRENT_SCORE_MESSAGE;
}

export type PopupRequest = GetCurrentScoreMessage | RefreshCurrentScoreMessage;

export type RuntimeStatus =
  | "disabled"
  | "unsupported"
  | "processing"
  | "ready"
  | "error";

/** Minimal, identifier-free scan state exposed to the toolbar popup. */
export interface PublicScanStatus {
  phase: ScanPhase;
  reason?: ScanStopReason;
}

/** Contains derived score output only and is never persisted. */
export interface CurrentScoreResponse {
  status: RuntimeStatus;
  result?: ScoreResult;
  badgeMounted?: boolean;
  scanStatus?: PublicScanStatus;
}

const RUNTIME_STATUSES: ReadonlySet<RuntimeStatus> = new Set([
  "disabled",
  "unsupported",
  "processing",
  "ready",
  "error"
]);

const SCAN_PHASES: ReadonlySet<ScanPhase> = new Set([
  "available",
  "scanning",
  "complete",
  "partial",
  "cancelled",
  "failed"
]);

const SCAN_STOP_REASONS: ReadonlySet<ScanStopReason> = new Set([
  "user-cancelled",
  "user-interaction",
  "page-hidden",
  "route-changed",
  "disabled",
  "teardown",
  "surface-replaced",
  "timeout",
  "step-limit",
  "verification-unreadable",
  "extractor-error",
  "no-route",
  "no-scroll-surface"
]);

const CRITERION_IDS = new Set([
  "identity-verification",
  "affiliation-verification",
  "account-age",
  "profile-maintenance",
  "work-history-detail",
  "career-chronology",
  "cross-section-consistency",
  "company-affiliation",
  "core-completeness",
  "activity-distribution",
  "reciprocal-engagement",
  "network-maturity",
  "recommendations",
  "content-specificity",
  "profile-image"
]);

function hasSafeCriterionMessage(value: unknown, requireImpact: boolean): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Record<string, unknown>;
  if (typeof item.criterion !== "string" || !CRITERION_IDS.has(item.criterion)) {
    return false;
  }
  if (
    typeof item.messageKey !== "string" ||
    !item.messageKey.startsWith(`criterion.${item.criterion}.`) ||
    item.messageKey.length > 160
  ) {
    return false;
  }
  return !requireImpact ||
    (typeof item.scoreImpact === "number" && Number.isFinite(item.scoreImpact));
}

function hasSafeScanStatus(value: unknown): value is PublicScanStatus {
  if (!value || typeof value !== "object") {
    return false;
  }
  const status = value as Record<string, unknown>;
  return SCAN_PHASES.has(status.phase as ScanPhase) &&
    (status.reason === undefined || SCAN_STOP_REASONS.has(status.reason as ScanStopReason));
}

/** Rejects malformed or unexpectedly text-bearing cross-context messages. */
export function isCurrentScoreResponse(value: unknown): value is CurrentScoreResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const response = value as Record<string, unknown>;
  if (!RUNTIME_STATUSES.has(response.status as RuntimeStatus)) {
    return false;
  }
  if (response.scanStatus !== undefined && !hasSafeScanStatus(response.scanStatus)) {
    return false;
  }
  if (response.result === undefined) {
    return true;
  }
  if (!response.result || typeof response.result !== "object") {
    return false;
  }
  const result = response.result as Record<string, unknown>;
  if (
    result.modelVersion !== "profile-evidence-v2" ||
    typeof result.score !== "number" ||
    !Number.isInteger(result.score) ||
    result.score < 0 ||
    result.score > 100 ||
    typeof result.coverage !== "number" ||
    !Number.isFinite(result.coverage) ||
    result.coverage < 0 ||
    result.coverage > 1 ||
    !Array.isArray(result.contributions) ||
    !result.explanations ||
    typeof result.explanations !== "object"
  ) {
    return false;
  }
  const explanations = result.explanations as Record<string, unknown>;
  return (
    Array.isArray(explanations.supporting) &&
    explanations.supporting.every((item) => hasSafeCriterionMessage(item, true)) &&
    Array.isArray(explanations.caution) &&
    explanations.caution.every((item) => hasSafeCriterionMessage(item, true)) &&
    Array.isArray(explanations.unavailable) &&
    explanations.unavailable.every((item) => hasSafeCriterionMessage(item, false)) &&
    result.contributions.every((item) => hasSafeCriterionMessage(item, true))
  );
}

export function isPopupRequest(value: unknown): value is PopupRequest {
  if (!value || typeof value !== "object") {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  return (
    type === GET_CURRENT_SCORE_MESSAGE ||
    type === REFRESH_CURRENT_SCORE_MESSAGE
  );
}
