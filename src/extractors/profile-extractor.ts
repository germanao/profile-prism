import {
  createEmptyProfileEvidence,
  type Observation,
  type ProfileEvidence,
  type ProfileImageEvidence,
} from "../scoring/evidence-schema";
import {
  extractionDictionaries,
  getExtractionDictionary,
  normalizeExtractionLocale,
  type ExtractionDictionary,
  type SupportedExtractionLocale,
} from "../locales/extraction";
import { extractActivityFacts } from "./activity";
import { extractCoreSectionFacts } from "./core-sections";
import { elementText, queryRendered, withDomReadSession } from "./dom";
import { extractExperienceFacts, headlineClaimsEstablishedRole } from "./experience";
import { extractNetworkMaturity } from "./network";
import { observed, unavailable } from "./observations";
import {
  deriveContentSpecificity,
  deriveCoreCompleteness,
  deriveCrossSectionConsistency,
  isBroadlyThinProfile,
} from "./profile-analysis";
import { extractRecommendations } from "./recommendations";
import { extractTopCardFacts } from "./top-card";
import type { ProfileExtractionOptions } from "./types";
import { extractVerificationFacts } from "./verification";

interface LocaleResolution {
  dictionary: ExtractionDictionary;
  locale: SupportedExtractionLocale;
  supportedLanguage: boolean;
}

function ownerDocument(root: ParentNode): Document | undefined {
  if ((root as Document).documentElement) return root as Document;
  return (root as Node).ownerDocument ?? undefined;
}

function localeFromVisibleHeadings(root: ParentNode): SupportedExtractionLocale | undefined {
  const text = queryRendered(root, "h2, h3, [role='heading']")
    .map((element) => elementText(element).toLocaleLowerCase())
    .filter(Boolean);
  let best: { locale: SupportedExtractionLocale; hits: number } | undefined;
  for (const [locale, dictionary] of Object.entries(extractionDictionaries) as Array<
    [SupportedExtractionLocale, ExtractionDictionary]
  >) {
    const labels = Object.values(dictionary.sectionLabels).flat().map((label) => label.toLocaleLowerCase(locale));
    const hits = text.filter((heading) => labels.includes(heading.toLocaleLowerCase(locale))).length;
    if (hits > (best?.hits ?? 0)) best = { locale, hits };
  }
  return best?.hits ? best.locale : undefined;
}

function resolveLocale(root: ParentNode, requested?: string): LocaleResolution {
  const documentLanguage = ownerDocument(root)?.documentElement?.lang;
  const raw = requested || documentLanguage;
  const base = raw?.trim().toLocaleLowerCase().split(/[-_]/u)[0];
  if (base === "en" || base === "pt" || base === "es") {
    return { dictionary: getExtractionDictionary(base), locale: base, supportedLanguage: true };
  }
  const inferred = localeFromVisibleHeadings(root);
  if (inferred) return { dictionary: getExtractionDictionary(inferred), locale: inferred, supportedLanguage: true };
  const locale = normalizeExtractionLocale(raw);
  return { dictionary: getExtractionDictionary(locale), locale, supportedLanguage: !raw };
}

export function isSupportedLinkedInProfileUrl(value: string | URL): boolean {
  try {
    const url = typeof value === "string" ? new URL(value) : value;
    return url.protocol === "https:" && url.hostname === "www.linkedin.com" && /^\/in\/[^/?#]+\/?$/u.test(url.pathname);
  } catch {
    return false;
  }
}

function mapProfileImage(
  imageKind: Observation<"personal" | "default_or_non_person" | "none">,
  isNewProfile: boolean,
  isBroadlyThin: boolean,
): Observation<ProfileImageEvidence> {
  if (imageKind.state !== "observed") return unavailable(imageKind.source);
  return observed(
    { kind: imageKind.value, isNewProfile, isBroadlyThin },
    imageKind.extractionConfidence,
    imageKind.source,
  );
}

/**
 * Reads only information that is already rendered beneath `root`.
 *
 * This function is synchronous, side-effect free, and safe to call again after
 * LinkedIn lazy-loads more DOM. It never clicks, scrolls, navigates, expands a
 * section, reads cookies, or performs a network request.
 */
export function extractProfileEvidence(
  root: ParentNode = document,
  options: ProfileExtractionOptions = {},
): ProfileEvidence {
  if (options.url && !isSupportedLinkedInProfileUrl(options.url)) {
    return createEmptyProfileEvidence("dom:unsupported-profile-route");
  }

  return withDomReadSession(() => extractProfileEvidenceInSession(root, options));
}

function extractProfileEvidenceInSession(
  root: ParentNode,
  options: ProfileExtractionOptions,
): ProfileEvidence {

  const { dictionary, supportedLanguage } = resolveLocale(root, options.locale);
  const now = options.now ? new Date(options.now) : new Date();
  const topCard = extractTopCardFacts(root, dictionary, now);
  const verification = extractVerificationFacts(root, dictionary);
  const sections = extractCoreSectionFacts(root, dictionary);
  const experience = extractExperienceFacts(root, dictionary, topCard);
  const broadlyThin = isBroadlyThinProfile(sections, experience);
  const coreCompleteness = deriveCoreCompleteness(sections);
  const activity = extractActivityFacts(root, dictionary, now, broadlyThin);
  const establishedClaim = topCard.headline.state === "observed" &&
    headlineClaimsEstablishedRole(topCard.headline.value, dictionary.locale);
  const isNewProfile = topCard.accountAge.state === "observed" && topCard.accountAge.value.days < 180;

  return {
    identityVerification: verification.identity,
    workplaceEducationVerification: verification.workplaceEducation,
    accountAge: topCard.accountAge,
    workHistoryDetail: experience.detail,
    careerChronology: experience.chronology,
    crossSectionConsistency: deriveCrossSectionConsistency(dictionary, topCard, experience, sections),
    companyAffiliation: experience.companyAffiliation,
    coreCompleteness,
    activityDistribution: activity.distribution,
    reciprocalEngagement: activity.engagement,
    networkMaturity: extractNetworkMaturity(root, dictionary, establishedClaim, broadlyThin),
    recommendations: extractRecommendations(root, dictionary),
    contentSpecificity: deriveContentSpecificity(dictionary, topCard, experience, sections, supportedLanguage),
    profileImage: mapProfileImage(topCard.imageKind, isNewProfile, broadlyThin),
  };
}

export type { ProfileExtractionOptions } from "./types";
export type { ProfileEvidence } from "../scoring/evidence-schema";
export { findProfileNameAnchor } from "./top-card";
export { findCurrentCompanyMatch, findTopCardScope } from "./current-company";
