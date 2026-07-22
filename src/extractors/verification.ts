import type { ExtractionDictionary } from "../locales/extraction";
import type {
  Observation,
  VerificationDetailsEvidence,
} from "../scoring/evidence-schema";
import { comparableText, elementText, isElementRendered, queryRendered } from "./dom";
import { absent, observed, unavailable } from "./observations";
import { findProfileNameAnchor } from "./top-card";

export interface VerificationFacts {
  /** Compatibility name: this is only the generic native badge in model v2. */
  identity: Observation<"active">;
  workplaceEducation: Observation<VerificationDetailsEvidence>;
}

function tokenPresent(text: string, tokens: readonly string[], locale: string): boolean {
  return tokens.some((token) => text.includes(comparableText(token, locale)));
}

function isVerificationInvitation(text: string): boolean {
  return /\b(?:get|start|add|complete\s+your|obter|iniciar|adicionar|adicione|verifique|obt[eé]n|inicia|agrega|a[nñ]ade)\b/iu.test(text) ||
    /\bverifica(?=\s+(?:tu|la)\b)/iu.test(text);
}

function completedKindPresent(
  texts: readonly string[],
  kindTokens: readonly string[],
  dictionary: ExtractionDictionary,
): boolean {
  return texts.some(
    (text) =>
      !isVerificationInvitation(text) &&
      tokenPresent(text, kindTokens, dictionary.locale) &&
      tokenPresent(text, dictionary.verification.verified, dictionary.locale),
  );
}

function descriptor(node: HTMLElement, dictionary: ExtractionDictionary): string {
  return comparableText(
    [
      elementText(node),
      node.getAttribute("aria-label"),
      node.getAttribute("alt"),
      node.getAttribute("title"),
      node.getAttribute("data-test-icon"),
    ].filter(Boolean).join(" "),
    dictionary.locale,
  );
}

function hasNativeProfileVerificationBadge(
  root: ParentNode,
  dictionary: ExtractionDictionary,
): boolean {
  const name = findProfileNameAnchor(root)?.element;
  const nameLink = name?.closest<HTMLElement>("a[href]");
  if (!name) return false;

  const scope = nameLink ?? name.parentElement;
  if (!scope) return false;
  const candidates = [scope, ...queryRendered<HTMLElement>(
    scope,
    "img, svg, [aria-label], [title], [data-test-icon]",
  )];
  return candidates.some((candidate) => {
    const text = descriptor(candidate, dictionary);
    // LinkedIn's rendered badge link currently exposes accessible copy such as
    // Current pages expose either a linked H2 badge or a sibling icon beside
    // the classic H1. In both cases the marker is confined to the name row.
    return /verif/iu.test(text) && !isVerificationInvitation(text);
  });
}

export function extractVerificationFacts(
  root: ParentNode,
  dictionary: ExtractionDictionary,
): VerificationFacts {
  const marked = queryRendered<HTMLElement>(
    root,
    [
      "[data-pe-verification]",
      "[data-profile-evidence-verification]",
      "[aria-label*='verif' i]",
      "[title*='verif' i]",
      "img[alt*='verif' i]",
      "[data-test-icon*='verif' i]",
    ].join(", "),
  );
  const panel = root.querySelector<HTMLElement>(
    "[data-pe-verification-panel], [data-profile-evidence-verification-panel]",
  );
  const visiblePanel = panel && isElementRendered(panel) ? panel : undefined;
  // Prefer individually marked rows so a completed workplace verification
  // cannot make a separate identity-verification invitation look completed.
  const textualCandidates = marked.length > 0 ? marked : visiblePanel ? [visiblePanel] : [];
  const candidateTexts = textualCandidates.map((node) => descriptor(node, dictionary));

  const explicitKinds = new Set(
    marked
      .flatMap((node) => [node.getAttribute("data-pe-verification"), node.getAttribute("data-profile-evidence-verification")])
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => value.split(/[\s,]+/u)),
  );
  const governmentIdFound =
    explicitKinds.has("identity") ||
    explicitKinds.has("government-id") ||
    completedKindPresent(candidateTexts, dictionary.verification.identity, dictionary);
  const nativeBadgeFound = hasNativeProfileVerificationBadge(root, dictionary);
  const workplaceFound =
    explicitKinds.has("workplace") ||
    completedKindPresent(candidateTexts, dictionary.verification.workplace, dictionary);
  const educationFound =
    explicitKinds.has("education") ||
    completedKindPresent(candidateTexts, dictionary.verification.education, dictionary);

  const panelComplete = visiblePanel?.getAttribute("data-complete") === "true";
  const identity = nativeBadgeFound
    ? observed<"active">("active", 0.96, "dom:verification:native-badge-visible")
    : panelComplete
      ? absent<"active">(0.96, "dom:verification:complete-panel-no-native-badge")
      : unavailable<"active">("dom:verification:native-badge-not-rendered");

  const workplaceMatch = explicitKinds.has("current-workplace")
    ? "current" as const
    : workplaceFound
      ? "former_or_unresolved" as const
      : "none" as const;
  const workplaceEducation = governmentIdFound || workplaceFound || educationFound || panelComplete
    ? observed(
      {
        governmentId: governmentIdFound,
        workplace: workplaceFound,
        workplaceMatch,
        education: educationFound,
      },
      explicitKinds.size > 0 || panelComplete ? 0.98 : 0.9,
      "dom:verification:explicit-methods-visible",
    )
    : unavailable<VerificationDetailsEvidence>("dom:verification:explicit-methods-not-rendered");

  return { identity, workplaceEducation };
}
