import {
  extractAboutMemberFacts,
  findCurrentCompanyMatch,
  findProfileNameAnchor,
  findTopCardScope,
  type ProfileEvidence,
} from "../extractors";
import { elementText, isElementRendered, queryRendered } from "../extractors/dom";
import { getExtractionDictionary } from "../locales/extraction";
import { waitForMutationQuiet } from "./scan-controller";
import type {
  NativeVerificationInspection,
  NativeVerificationInspector,
  ScanSettle,
} from "./scan-types";

const DIALOG_SELECTOR = "[role='dialog'], dialog[open]";
export const NATIVE_INSPECTION_ATTRIBUTE =
  "data-profile-authenticity-native-inspection";
export const NATIVE_INSPECTION_VALUE = "suppressed";
const VERIFICATION_DESCRIPTOR_SELECTOR = [
  "[data-pe-verification-control]",
  "[data-profile-evidence-verification-control]",
  "[aria-label*='verif' i]",
  "[title*='verif' i]",
].join(", ");
const INTERACTIVE_SELECTOR = "button, a[href], [role='button'], [tabindex]";
const VERIFICATION_TRIGGER_REF_SELECTOR = "[componentkey^='ProfileVerificationTriggerRef-']";
const PROGRESS_SELECTOR = "[aria-busy='true'], [role='progressbar'], progress, .artdeco-loader";
const DIALOG_READY_TIMEOUT_MS = 2_500;
const DIALOG_QUIET_MS = 250;

interface ControlLookup {
  kind: "found" | "not-present" | "ambiguous";
  control?: Element;
}

interface DialogLookup {
  kind: "found" | "timeout" | "ambiguous";
  dialog?: HTMLElement;
}

export interface NativeAboutMemberInspectorOptions {
  locale?: string | (() => string | undefined);
  now?: () => Date;
  currentEmployer?: (document: Document) => string | undefined;
  settle?: ScanSettle;
  dialogTimeoutMs?: number;
  /** Test seam; production keeps the native-dialog readiness bound at 2.5 seconds. */
  dialogReadyTimeoutMs?: number;
  closeTimeoutMs?: number;
}

function normalizedDescriptor(element: Element): string {
  return [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.getAttribute("data-test-icon"),
    elementText(element),
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

function isLocalizedVerificationControl(element: Element): boolean {
  if (
    element.matches("[data-pe-verification-control], [data-profile-evidence-verification-control]")
  ) {
    return true;
  }
  const descriptor = normalizedDescriptor(element);
  const hasVerificationNoun = /\bverifica(?:tion|tions|cao|coes|cion|ciones)\b/u.test(descriptor);
  const hasViewAction = /\b(?:view|see|show|ver|visualizar|consultar)\b/u.test(descriptor);
  const invitation = /\b(?:get|start|add|complete|obter|iniciar|adicionar|agregar|anadir)\b/u.test(descriptor);
  return hasVerificationNoun && hasViewAction && !invitation;
}

function interactiveOwner(candidate: Element, scope: HTMLElement): Element | null {
  const owner = candidate.matches(INTERACTIVE_SELECTOR)
    ? candidate
    : candidate.closest(INTERACTIVE_SELECTOR);
  return owner && scope.contains(owner) ? owner : null;
}

/**
 * LinkedIn currently renders the name-row verification affordance as a
 * labelled SVG inside a non-interactive component wrapper. Keep this fallback
 * deliberately narrow: a generic verification/verified badge is not enough,
 * and unrelated labelled SVGs must never become activation targets.
 */
function standaloneSvgOwner(candidate: Element, scope: HTMLElement): Element | null {
  if (!candidate.matches("svg[role='img'][aria-label]")) return null;
  const descriptor = normalizedDescriptor(candidate);
  const hasPluralVerificationLabel = /\b(?:verifications|verificacoes|verificaciones)\b/u.test(
    descriptor,
  );
  const hasViewAction = /\b(?:view|see|show|ver|visualizar|consultar)\b/u.test(descriptor);
  const describesGenericArtwork = /\b(?:badge|icon|selo|icone|insignia|icono)\b/u.test(descriptor);
  if (!hasPluralVerificationLabel || !hasViewAction || describesGenericArtwork) return null;
  const owner = candidate.closest(VERIFICATION_TRIGGER_REF_SELECTOR);
  return owner && scope.contains(owner) ? owner : null;
}

/** Confines discovery to the closest name-row ancestor containing a badge. */
export function findNativeVerificationControl(document: Document): ControlLookup {
  const name = findProfileNameAnchor(document)?.element;
  if (!name) return { kind: "not-present" };

  let scope = name.parentElement;
  for (let depth = 0; scope && depth < 6; depth += 1, scope = scope.parentElement) {
    if (scope.matches("main, [role='main'], body, html")) break;
    const descriptorNodes = [
      ...(scope.matches(VERIFICATION_DESCRIPTOR_SELECTOR) ? [scope] : []),
      ...scope.querySelectorAll(VERIFICATION_DESCRIPTOR_SELECTOR),
    ].filter(
      (candidate) =>
        isElementRendered(candidate) &&
        candidate.closest("[data-profile-authenticity-host]") === null &&
        isLocalizedVerificationControl(candidate),
    );
    const controlsByOwner = new Map<Element, Element>();
    for (const candidate of descriptorNodes) {
      const standaloneOwner = standaloneSvgOwner(candidate, scope);
      const owner = interactiveOwner(candidate, scope) ?? standaloneOwner;
      if (!owner) continue;
      // Some LinkedIn variants place the badge SVG inside the ordinary name
      // link. Dispatch at the badge itself so its delegated handler receives
      // the same target a real pointer activation would, rather than invoking
      // the profile link as a generic navigation.
      const activationTarget = (
        standaloneOwner !== null ||
        (owner.matches("a[href]") && owner.contains(name) && owner !== candidate)
      )
        ? candidate
        : owner;
      controlsByOwner.set(owner, activationTarget);
    }
    const controls = Array.from(controlsByOwner.values());
    if (controls.length === 1) return { kind: "found", control: controls[0]! };
    if (controls.length > 1) return { kind: "ambiguous" };
  }
  return { kind: "not-present" };
}

function renderedDialogs(document: Document): HTMLElement[] {
  return queryRendered<HTMLElement>(document, DIALOG_SELECTOR);
}

function waitForNewDialog(
  document: Document,
  existing: ReadonlySet<HTMLElement>,
  signal: AbortSignal,
  timeoutMs: number,
  onFound?: (dialog: HTMLElement) => void,
): Promise<DialogLookup> {
  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
    let settled = false;
    const finish = (result: DialogLookup): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      if (timeout !== undefined) globalThis.clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      resolve(result);
    };
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      if (timeout !== undefined) globalThis.clearTimeout(timeout);
      reject(new DOMException("The profile scan was cancelled.", "AbortError"));
    };
    const inspect = (): void => {
      const opened = renderedDialogs(document).filter((dialog) => !existing.has(dialog));
      if (opened.length === 1) {
        const dialog = opened[0]!;
        /*
         * MutationObserver callbacks run before the next paint. Marking the
         * newly opened dialog here prevents a top-layer LinkedIn modal from
         * flashing above the extension's scan progress dialog.
         */
        onFound?.(dialog);
        finish({ kind: "found", dialog });
      }
      else if (opened.length > 1) finish({ kind: "ambiguous" });
    };
    const observer = new MutationObserver(inspect);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["aria-hidden", "hidden", "open", "style"],
      childList: true,
      subtree: true,
    });
    signal.addEventListener("abort", onAbort, { once: true });
    timeout = globalThis.setTimeout(() => finish({ kind: "timeout" }), timeoutMs);
    inspect();
  });
}

function activate(control: Element): void {
  const clickable = control as Element & { click?: () => void };
  if (typeof clickable.click === "function") {
    clickable.click();
    return;
  }
  control.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }));
}

function hasRenderedProgress(dialog: HTMLElement): boolean {
  return queryRendered(dialog, PROGRESS_SELECTOR).length > 0 ||
    (dialog.matches(PROGRESS_SELECTOR) && isElementRendered(dialog));
}

function abortError(): DOMException {
  return new DOMException("The profile scan was cancelled.", "AbortError");
}

/**
 * Avoids a tight loop when an injected settle function returns immediately.
 * In production the ordinary quiet wait normally covers this window, while
 * this observer also lets us resume as soon as a static spinner disappears.
 */
function waitForProgressChange(
  dialog: HTMLElement,
  signal: AbortSignal,
  maxWaitMs: number,
): Promise<void> {
  if (signal.aborted) return Promise.reject(abortError());
  if (!hasRenderedProgress(dialog) || maxWaitMs <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let finished = false;
    let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
    const cleanup = (): void => {
      observer.disconnect();
      if (timeout !== undefined) globalThis.clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    };
    const finish = (): void => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve();
    };
    const onAbort = (): void => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(abortError());
    };
    const inspect = (): void => {
      if (!hasRenderedProgress(dialog)) finish();
    };
    const observer = new MutationObserver(inspect);
    observer.observe(dialog, {
      attributes: true,
      attributeFilter: ["aria-busy", "hidden", "style", "class"],
      childList: true,
      subtree: true,
    });
    signal.addEventListener("abort", onAbort, { once: true });
    timeout = globalThis.setTimeout(finish, maxWaitMs);
    inspect();
  });
}

/**
 * A quiet DOM is not ready while LinkedIn still renders a progress indicator.
 * Keep observing within one absolute bound, then require one final quiet
 * window after the indicator disappears before parsing.
 */
async function waitForDialogReady(
  dialog: HTMLElement,
  signal: AbortSignal,
  settle: ScanSettle,
  maxWaitMs: number,
): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs) {
    if (signal.aborted) throw abortError();
    const remaining = Math.max(1, maxWaitMs - (Date.now() - startedAt));
    const settled = await settle({
      root: dialog,
      signal,
      quietMs: DIALOG_QUIET_MS,
      maxWaitMs: remaining,
      final: true,
    });
    if (settled.timedOut) return false;
    if (!hasRenderedProgress(dialog)) return true;

    const afterSettleRemaining = maxWaitMs - (Date.now() - startedAt);
    if (afterSettleRemaining <= 0) return false;
    await waitForProgressChange(
      dialog,
      signal,
      Math.min(DIALOG_QUIET_MS, afterSettleRemaining),
    );
  }
  return false;
}

function localizedCloseControl(dialog: HTMLElement): Element | null {
  const candidates = queryRendered<HTMLElement>(dialog, [
    "button",
    "[role='button']",
    "[data-test-modal-close-btn]",
    "[aria-label]",
  ].join(", "));
  for (const candidate of candidates) {
    if (candidate.closest("[data-profile-authenticity-host]")) continue;
    const descriptor = normalizedDescriptor(candidate);
    if (
      /^(?:done|close|dismiss|ok|got it|pronto|fechar|concluir|dispensar|listo|cerrar|descartar|hecho)$/u.test(descriptor) ||
      candidate.matches("[data-test-modal-close-btn]")
    ) {
      return candidate.matches(INTERACTIVE_SELECTOR)
        ? candidate
        : candidate.closest(INTERACTIVE_SELECTOR);
    }
  }
  return null;
}

function isDialogClosed(dialog: HTMLElement): boolean {
  return !dialog.isConnected ||
    !isElementRendered(dialog) ||
    (dialog.tagName === "DIALOG" && !dialog.hasAttribute("open"));
}

/** Requests closure without assuming LinkedIn's current modal implementation. */
function requestDialogClose(dialog: HTMLElement): void {
  if (isDialogClosed(dialog)) return;

  const closeControl = localizedCloseControl(dialog);
  if (closeControl) {
    try {
      activate(closeControl);
    } catch {
      // Continue to the native/Escape fallbacks below.
    }
    if (isDialogClosed(dialog)) return;
  }

  if (dialog.tagName === "DIALOG") {
    const nativeDialog = dialog as HTMLDialogElement;
    if (typeof nativeDialog.close === "function") {
      try {
        nativeDialog.close();
      } catch {
        // A page-owned dialog can reject close(); Escape remains best effort.
      }
      if (isDialogClosed(dialog)) return;
    }
  }

  // LinkedIn modal implementations commonly listen for Escape above the
  // dialog. The event is intentionally synthetic and cannot be mistaken for
  // the trusted user input that cancels the scan controller.
  try {
    dialog.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
      cancelable: true,
      composed: true,
    }));
  } catch {
    // Cleanup is best effort and must never hide the inspection result.
  }
}

function waitForDialogClosed(
  dialog: HTMLElement,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<boolean> {
  if (isDialogClosed(dialog)) return Promise.resolve(true);
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
    const cleanup = (): void => {
      observer.disconnect();
      if (timeout !== undefined) globalThis.clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    };
    const finish = (closed: boolean): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(closed);
    };
    const inspect = (): void => {
      if (isDialogClosed(dialog)) finish(true);
    };
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new DOMException("The profile scan was cancelled.", "AbortError"));
    };
    const observer = new MutationObserver(inspect);
    observer.observe(dialog.ownerDocument.documentElement, {
      attributes: true,
      attributeFilter: ["aria-hidden", "hidden", "open", "style"],
      childList: true,
      subtree: true,
    });
    signal.addEventListener("abort", onAbort, { once: true });
    timeout = globalThis.setTimeout(() => finish(false), timeoutMs);
    inspect();
  });
}

function resolveLocale(document: Document, configured?: NativeAboutMemberInspectorOptions["locale"]): string {
  const explicit = typeof configured === "function" ? configured() : configured;
  if (explicit) return explicit;
  try {
    return new URL(document.location.href).searchParams.get("locale") ?? document.documentElement.lang;
  } catch {
    return document.documentElement.lang;
  }
}

/** Reads the visible current-company label only for transient dialog matching. */
export function findTransientCurrentEmployer(document: Document): string | undefined {
  const name = findProfileNameAnchor(document)?.element;
  if (!name) return undefined;
  const topCard = findTopCardScope(document, name);
  const company = findCurrentCompanyMatch(topCard, name)?.element;
  const value = elementText(company);
  return value || undefined;
}

/**
 * Creates the user-activated inspector used by FullProfileScanController.
 * Constructing it is side-effect free; the only click occurs when the scan
 * controller invokes the returned function after a FAB activation.
 */
export function createNativeAboutMemberInspector(
  options: NativeAboutMemberInspectorOptions = {},
): NativeVerificationInspector<ProfileEvidence> {
  return async ({ document, signal }): Promise<NativeVerificationInspection<ProfileEvidence>> => {
    if (signal.aborted) throw new DOMException("The profile scan was cancelled.", "AbortError");
    const lookup = findNativeVerificationControl(document);
    if (lookup.kind === "not-present") return { status: "not-present" };
    if (lookup.kind === "ambiguous" || !lookup.control) return { status: "unreadable" };

    const employer = (options.currentEmployer ?? findTransientCurrentEmployer)(document);
    const before = new Set(renderedDialogs(document));
    activate(lookup.control);
    const opened = await waitForNewDialog(
      document,
      before,
      signal,
      options.dialogTimeoutMs ?? 3_000,
      (dialog) => {
        dialog.setAttribute(NATIVE_INSPECTION_ATTRIBUTE, NATIVE_INSPECTION_VALUE);
      },
    );
    if (opened.kind !== "found" || !opened.dialog) return { status: "unreadable" };

    const dialog = opened.dialog;
    let evidence: Partial<ProfileEvidence> | undefined;
    let readable = false;
    let inspectionError: unknown;
    let closed = false;
    try {
      const ready = await waitForDialogReady(
        dialog,
        signal,
        options.settle ?? waitForMutationQuiet,
        options.dialogReadyTimeoutMs ?? DIALOG_READY_TIMEOUT_MS,
      );
      if (ready) {
        const dictionary = getExtractionDictionary(resolveLocale(document, options.locale));
        const facts = extractAboutMemberFacts(dialog, dictionary, {
          now: options.now?.() ?? new Date(),
          ...(employer ? { currentEmployer: employer } : {}),
        });
        evidence = {
          workplaceEducationVerification: facts.verificationDetails,
          accountAge: facts.accountAge,
          profileMaintenance: facts.profileMaintenance,
        };
        readable = [facts.verificationDetails, facts.accountAge, facts.profileMaintenance]
          .some((observation) => observation.state !== "unavailable");
      }
    } catch (error) {
      inspectionError = error;
    } finally {
      requestDialogClose(dialog);
      if (!signal.aborted) {
        try {
          closed = await waitForDialogClosed(dialog, signal, options.closeTimeoutMs ?? 1_500);
        } catch (error) {
          inspectionError ??= error;
        }
      } else {
        closed = isDialogClosed(dialog);
      }
      /*
       * Never leave an invisible top-layer dialog behind if LinkedIn's close
       * handlers fail. This node was uniquely discovered after this scan's
       * activation, so removing it is a scoped final cleanup.
       */
      if (!closed && dialog.isConnected) {
        try {
          dialog.remove();
          closed = isDialogClosed(dialog);
        } catch {
          // The unreadable result below preserves the failure if cleanup loses.
        }
      }
      dialog.removeAttribute(NATIVE_INSPECTION_ATTRIBUTE);
    }

    // Even on route change or user cancellation, request that LinkedIn close
    // a dialog already opened by this scan before propagating the abort.
    if (inspectionError && signal.aborted) throw inspectionError;
    if (inspectionError || !readable || !closed) return evidence
      ? { status: "unreadable", evidence }
      : { status: "unreadable" };
    return evidence ? { status: "inspected", evidence } : { status: "unreadable" };
  };
}
