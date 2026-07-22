import { extractProfileEvidence } from "../extractors/profile-extractor";
import {
  CRITERIA_V2,
  evaluateProfileEvidence,
  type ProfileEvidence,
  type ScoreResult
} from "../scoring";
import {
  GET_CURRENT_SCORE_MESSAGE,
  isPopupRequest,
  REFRESH_CURRENT_SCORE_MESSAGE,
  type CurrentScoreResponse,
  type PublicScanStatus
} from "../platform/messages";
import { onRuntimeMessage } from "../platform/browser-api";
import {
  getPreferences,
  onPreferencesChanged,
  type Preferences
} from "../platform/storage";
import {
  findProfileNameAnchor,
  mountBadge,
  type BadgeController
} from "../ui/badge";
import {
  mountScanFab,
  type ScanFabController,
  type ScanFabModel
} from "../ui/fab";
import {
  createEvidencePopover,
  type EvidencePopoverController
} from "../ui/evidence-popover";
import {
  createScanOverlay,
  type ScanOverlayController,
  type ScanOverlayModel
} from "../ui/scan-overlay";
import { resolveUiLocale, type SupportedUiLocale } from "../ui/copy";
import { mergeEvidenceSnapshots } from "./evidence-accumulator";
import { createNativeAboutMemberInspector } from "./native-about-member-inspector";
import {
  FullProfileScanController,
  type ScanPresentationState,
  type ScanProgress
} from "./scan-controller";
import {
  findProfileScrollSurface,
  returnSurfaceToTop
} from "./scroll-surface";
import {
  RouteCoordinator,
  type ProfileRoute,
  type RouteEvent
} from "./route-coordinator";

const EVIDENCE_CRITERIA_COUNT = CRITERIA_V2.length;

/**
 * Owns all profile-derived state. Evidence and score output exist only in this
 * instance's route-local memory and are cleared on navigation, disablement, or
 * teardown.
 */
export class MountController {
  private readonly document: Document;
  private readonly location: Location;
  private routeCoordinator: RouteCoordinator | null = null;
  private scanController: FullProfileScanController<ProfileEvidence> | null = null;
  private badge: BadgeController | null = null;
  private fab: ScanFabController | null = null;
  private popover: EvidencePopoverController | null = null;
  private scanOverlay: ScanOverlayController | null = null;
  private currentRoute: ProfileRoute | null = null;
  private currentEvidence: ProfileEvidence | null = null;
  private currentEvidenceFingerprint: string | null = null;
  private currentEvaluationFingerprint: string | null = null;
  private currentResult: ScoreResult | null = null;
  private surfaceFingerprint: string | null = null;
  private scanState: ScanPresentationState | null = null;
  private preferences: Preferences = {
    enabled: true,
    uiLocale: "auto",
    acceptedDisclosureVersion: null
  };
  private locale: SupportedUiLocale = "en";
  private status: CurrentScoreResponse["status"] = "processing";
  private started = false;
  private processing = false;
  private refreshQueued = false;
  private incompleteCleanupSequence = 0;
  private removeMessageListener: (() => void) | null = null;
  private removeStorageListener: (() => void) | null = null;

  constructor(options: { document?: Document; location?: Location } = {}) {
    this.document = options.document ?? document;
    this.location = options.location ?? location;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    this.removeMessageListener = onRuntimeMessage((message) => {
      if (!isPopupRequest(message)) {
        return undefined;
      }
      if (message.type === REFRESH_CURRENT_SCORE_MESSAGE) {
        this.refreshVisibleEvidence();
      }
      if (message.type === GET_CURRENT_SCORE_MESSAGE || message.type === REFRESH_CURRENT_SCORE_MESSAGE) {
        return this.publicState();
      }
      return undefined;
    });

    this.removeStorageListener = onPreferencesChanged((preferences) => {
      this.applyPreferences(preferences);
    });

    try {
      this.preferences = await getPreferences();
    } catch {
      // A storage failure must not recreate the removed first-run gate. The
      // scorer remains local-only and starts with its safe default settings.
      this.preferences = {
        enabled: true,
        uiLocale: "auto",
        acceptedDisclosureVersion: null
      };
    }
    if (!this.started) {
      return;
    }
    this.locale = resolveUiLocale(this.preferences.uiLocale);
    this.status = this.preferences.enabled ? "processing" : "disabled";

    this.scanController = new FullProfileScanController<ProfileEvidence>({
      document: this.document,
      extractEvidence: () => this.extractCurrentEvidence(),
      inspectNativeVerification: createNativeAboutMemberInspector(),
      onProgress: (progress) => this.handleScanProgress(progress)
    });

    this.routeCoordinator = new RouteCoordinator(
      (event) => this.handleRouteEvent(event),
      { document: this.document, location: this.location }
    );
    this.routeCoordinator.start();
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.routeCoordinator?.stop();
    this.routeCoordinator = null;
    this.scanController?.dispose();
    this.scanController = null;
    this.removeMessageListener?.();
    this.removeMessageListener = null;
    this.removeStorageListener?.();
    this.removeStorageListener = null;
    this.clearProfileState();
    this.currentRoute = null;
    this.status = "disabled";
  }

  publicState(): CurrentScoreResponse {
    const scanStatus = this.publicScanStatus();
    if (this.currentResult) {
      return {
        status: this.status,
        result: this.currentResult,
        badgeMounted: Boolean(this.badge?.host.isConnected),
        ...(scanStatus ? { scanStatus } : {})
      };
    }
    return {
      status: this.status,
      ...(scanStatus ? { scanStatus } : {})
    };
  }

  refreshVisibleEvidence(): void {
    if (!this.started || !this.preferences.enabled || !this.currentRoute) {
      return;
    }
    // The scan coordinator extracts after each settled step. A parallel route
    // refresh here could publish a smaller, non-accumulated snapshot.
    if (this.scanState?.phase === "scanning") {
      return;
    }
    if (this.processing) {
      this.refreshQueued = true;
      return;
    }

    const routeKey = this.currentRoute.key;
    this.processing = true;
    this.status = "processing";
    try {
      const extracted = this.extractCurrentEvidence();
      const merged = this.currentEvidence
        ? mergeEvidenceSnapshots<ProfileEvidence>(this.currentEvidence, extracted)
        : extracted;
      const evidence = merged as ProfileEvidence;
      const evidenceFingerprint = JSON.stringify(evidence);
      const evaluationFingerprint = JSON.stringify({
        evidenceFingerprint,
        fullScanCompleted: this.scanState?.phase === "complete",
        verificationDetailsInspected: this.scanState?.verificationInspected === true
      });
      if (evaluationFingerprint === this.currentEvaluationFingerprint && this.currentResult) {
        this.currentEvidence = evidence;
        this.status = "ready";
        this.mountOrUpdateScoreSurfaces(this.currentResult);
        return;
      }
      const result = evaluateProfileEvidence(evidence, {
        fullScanCompleted: this.scanState?.phase === "complete",
        verificationDetailsInspected: this.scanState?.verificationInspected === true
      });
      if (
        !this.started ||
        !this.preferences.enabled ||
        this.currentRoute?.key !== routeKey
      ) {
        return;
      }
      this.currentEvidence = evidence;
      this.currentEvidenceFingerprint = evidenceFingerprint;
      this.currentEvaluationFingerprint = evaluationFingerprint;
      this.currentResult = result;
      this.status = "ready";
      this.mountOrUpdateScoreSurfaces(result);
    } catch {
      // Preserve a previously published route-local result if a transient
      // LinkedIn render makes one extraction fail.
      if (!this.currentResult) {
        this.badge?.destroy();
        this.badge = null;
        this.fab?.destroy();
        this.fab = null;
      }
      this.status = "error";
    } finally {
      this.processing = false;
      if (this.refreshQueued) {
        this.refreshQueued = false;
        queueMicrotask(() => this.refreshVisibleEvidence());
      }
    }
  }

  private extractCurrentEvidence(): ProfileEvidence {
    if (!this.currentRoute) {
      throw new Error("A supported profile route is required for extraction.");
    }
    return extractProfileEvidence(this.document, { url: this.currentRoute.url });
  }

  private applyPreferences(preferences: Preferences): void {
    const wasEnabled = this.preferences.enabled;
    const previousLocale = this.locale;
    this.preferences = preferences;
    this.locale = resolveUiLocale(preferences.uiLocale);

    if (!preferences.enabled) {
      this.scanController?.disable();
      this.scanController?.setRoute(null);
      this.clearProfileState();
      this.status = "disabled";
      return;
    }

    if (!wasEnabled && this.currentRoute) {
      this.scanController?.setRoute(this.currentRoute.key);
    }
    if (this.currentResult && previousLocale !== this.locale) {
      this.mountOrUpdateScoreSurfaces(this.currentResult);
    }
    if (!wasEnabled || (!this.currentResult && this.currentRoute)) {
      this.status = this.currentRoute ? "processing" : "unsupported";
      this.refreshVisibleEvidence();
    }
  }

  private handleRouteEvent(event: RouteEvent): void {
    if (event.kind === "badge-mount-invalidated") {
      if (
        this.preferences.enabled &&
        this.currentResult &&
        this.currentRoute?.key === event.route.key
      ) {
        this.ensureBadgeMounted(this.currentResult, this.cardOptions());
      }
      return;
    }
    if (event.kind === "route-changed") {
      this.scanController?.setRoute(null);
      this.clearProfileState();
      this.currentRoute = event.route;
      if (!this.preferences.enabled) {
        this.status = "disabled";
      } else if (!event.route) {
        this.status = "unsupported";
      } else {
        this.scanController?.setRoute(event.route.key);
        this.status = "processing";
        this.refreshVisibleEvidence();
      }
      return;
    }

    if (
      this.preferences.enabled &&
      this.currentRoute?.key === event.route.key &&
      this.scanState?.phase !== "scanning"
    ) {
      this.refreshVisibleEvidence();
    }
  }

  private handleScanProgress(progress: ScanProgress<ProfileEvidence>): void {
    if (!this.started || progress.state.routeKey !== this.currentRoute?.key) {
      return;
    }
    this.scanState = progress.state;

    if (progress.evidence) {
      const merged = this.currentEvidence
        ? mergeEvidenceSnapshots<ProfileEvidence>(this.currentEvidence, progress.evidence)
        : progress.evidence;
      const evidence = merged as ProfileEvidence;
      const evidenceFingerprint = JSON.stringify(evidence);
      const evaluationFingerprint = JSON.stringify({
        evidenceFingerprint,
        fullScanCompleted: progress.state.phase === "complete",
        verificationDetailsInspected: progress.state.verificationInspected
      });
      const result = evaluationFingerprint === this.currentEvaluationFingerprint && this.currentResult
        ? this.currentResult
        : evaluateProfileEvidence(evidence, {
          fullScanCompleted: progress.state.phase === "complete",
          verificationDetailsInspected: progress.state.verificationInspected
        });
      this.currentEvidence = evidence;
      this.currentEvidenceFingerprint = evidenceFingerprint;
      this.currentEvaluationFingerprint = evaluationFingerprint;
      this.currentResult = result;
      this.status = "ready";
      this.mountOrUpdateScoreSurfaces(result);
    } else if (this.currentResult) {
      this.mountOrUpdateScoreSurfaces(this.currentResult);
    }
    this.updateScanOverlay();
  }

  private startFullScan(): void {
    if (
      !this.preferences.enabled ||
      !this.currentRoute ||
      !this.scanController ||
      !this.currentResult ||
      !this.fab
    ) {
      return;
    }
    this.incompleteCleanupSequence += 1;
    this.scanOverlay ??= createScanOverlay(this.document, {
      cancel: () => this.scanController?.cancel("user-cancelled"),
      retry: () => this.startFullScan(),
      close: () => undefined
    });
    this.scanOverlay.show(this.fab.trigger, {
      phase: "scanning",
      stage: "preparing",
      locale: this.locale,
      score: this.currentResult.score,
      ...this.cardProgress(),
      elapsedMs: 0
    });
    this.scanController.setRoute(this.currentRoute.key);
    void this.scanController.start();
  }

  private scanOverlayModel(): ScanOverlayModel | null {
    if (!this.scanState || this.scanState.phase === "available") return null;
    return {
      phase: this.scanState.phase,
      stage: this.scanState.stage,
      locale: this.locale,
      ...(this.currentResult ? { score: this.currentResult.score } : {}),
      ...this.cardProgress(),
      elapsedMs: this.scanState.elapsedMs,
      ...(this.scanState.reason ? { reason: this.scanState.reason } : {})
    };
  }

  private updateScanOverlay(): void {
    const model = this.scanOverlayModel();
    if (!this.scanOverlay || !model) return;
    if (
      model.phase === "partial" ||
      model.phase === "failed" ||
      model.phase === "cancelled"
    ) {
      this.finishIncompleteScan(model);
      return;
    }
    this.scanOverlay.update(model);
  }

  private finishIncompleteScan(model: ScanOverlayModel): void {
    const routeKey = this.currentRoute?.key;
    const cleanupSequence = ++this.incompleteCleanupSequence;
    const skipScroll =
      this.document.hidden ||
      model.reason === "page-hidden" ||
      model.reason === "route-changed" ||
      model.reason === "disabled" ||
      model.reason === "teardown";

    if (skipScroll || !routeKey) {
      this.scanOverlay?.hide({ immediate: true });
      return;
    }

    /*
     * Keep the existing progress surface truthful during the brief cleanup,
     * then remove it automatically. A terminal "Scan incomplete" dialog is
     * never presented to the user.
     */
    this.scanOverlay?.update({
      ...model,
      phase: "scanning",
      stage: "returning"
    });
    const surface = findProfileScrollSurface(this.document);
    const returning = surface
      ? returnSurfaceToTop(surface)
      : Promise.resolve(false);

    void returning
      .catch(() => false)
      .finally(() => {
        if (
          cleanupSequence !== this.incompleteCleanupSequence ||
          !this.started ||
          this.currentRoute?.key !== routeKey
        ) {
          return;
        }
        this.scanOverlay?.hide();
      });
  }

  private cardProgress(): { checkedCount: number; totalCount: number } {
    return {
      checkedCount: Math.max(
        0,
        EVIDENCE_CRITERIA_COUNT - (this.currentResult?.explanations.unavailable.length ?? EVIDENCE_CRITERIA_COUNT)
      ),
      totalCount: EVIDENCE_CRITERIA_COUNT
    };
  }

  private fabModel(result: ScoreResult): ScanFabModel {
    return {
      state: this.scanState?.phase ?? "available",
      locale: this.locale,
      result,
      ...this.cardProgress()
    };
  }

  private cardOptions(): {
    mode: "initial" | "full";
    checkedCount: number;
    totalCount: number;
  } {
    return {
      mode: this.scanState?.phase === "complete" ? "full" : "initial",
      ...this.cardProgress()
    };
  }

  private mountOrUpdateScoreSurfaces(result: ScoreResult): void {
    this.popover ??= createEvidencePopover(this.document);
    const cardOptions = this.cardOptions();
    const fabModel = this.fabModel(result);
    const nextFingerprint = JSON.stringify({ result, locale: this.locale, cardOptions, fabModel });
    if (
      nextFingerprint === this.surfaceFingerprint &&
      this.badge?.host.isConnected &&
      this.fab?.host.isConnected
    ) {
      return;
    }
    this.ensureBadgeMounted(result, cardOptions, true);

    if (this.fab?.host.isConnected) {
      this.fab.update(fabModel);
    } else {
      this.fab?.destroy();
      this.fab = mountScanFab(fabModel, {
        start: () => this.startFullScan(),
        cancel: () => this.scanController?.cancel("user-cancelled"),
        retry: () => this.startFullScan()
      }, {
        popover: this.popover
      });
    }
    this.surfaceFingerprint = nextFingerprint;
  }

  private ensureBadgeMounted(
    result: ScoreResult,
    cardOptions: ReturnType<MountController["cardOptions"]>,
    updateExisting = false
  ): void {
    this.popover ??= createEvidencePopover(this.document);
    const anchor = findProfileNameAnchor(this.document);
    if (!anchor) {
      this.badge?.destroy();
      this.badge = null;
    } else if (this.badge?.anchor === anchor && this.badge.host.isConnected) {
      if (updateExisting) this.badge.update(result, this.locale, cardOptions);
    } else {
      this.badge?.destroy();
      this.badge = mountBadge(anchor, result, this.locale, {
        popover: this.popover
      });
      this.badge.update(result, this.locale, cardOptions);
    }
  }

  private publicScanStatus(): PublicScanStatus | undefined {
    if (!this.currentRoute || !this.scanState) {
      return undefined;
    }
    return this.scanState.reason
      ? { phase: this.scanState.phase, reason: this.scanState.reason }
      : { phase: this.scanState.phase };
  }

  private clearProfileState(): void {
    this.incompleteCleanupSequence += 1;
    this.scanOverlay?.destroy();
    this.scanOverlay = null;
    this.badge?.destroy();
    this.badge = null;
    this.fab?.destroy();
    this.fab = null;
    this.popover?.destroy();
    this.popover = null;
    this.currentEvidence = null;
    this.currentEvidenceFingerprint = null;
    this.currentEvaluationFingerprint = null;
    this.currentResult = null;
    this.surfaceFingerprint = null;
    this.scanState = null;
    this.processing = false;
    this.refreshQueued = false;
  }
}
