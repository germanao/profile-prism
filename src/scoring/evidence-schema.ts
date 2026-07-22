/**
 * Browser- and DOM-independent input contract for the profile evidence model.
 *
 * Extractors must use `unavailable` whenever a fact is hidden, not loaded, or
 * cannot be interpreted reliably. `absent` is reserved for a fact whose
 * absence was positively established from the rendered page.
 */
export type ObservationState = "observed" | "absent" | "unavailable";

export type ObservedObservation<T> = {
  state: "observed";
  value: T;
  extractionConfidence: number;
  source: string;
};

export type NonObservedObservation = {
  state: "absent" | "unavailable";
  value?: never;
  extractionConfidence: number;
  source: string;
};

export type Observation<T> = ObservedObservation<T> | NonObservedObservation;

export type WorkHistoryDetail =
  | "several_substantive_dated_roles"
  | "adequate"
  | "established_empty_or_vague"
  | "neutral";

export type CareerChronology =
  | "rich_coherent"
  | "consistent"
  | "material_contradiction"
  | "neutral";

export type CrossSectionConsistency =
  | "strong_alignment"
  | "partial_alignment"
  | "material_conflict"
  | "neutral";

export type CompanyAffiliation =
  | "linked_employer_specific_role"
  | "material_identity_conflict"
  | "neutral";

export type CoreCompleteness =
  | "several_substantive_sections"
  | "adequate"
  | "three_or_more_confirmed_empty"
  | "neutral";

export type ActivityDistribution =
  | "distributed_over_years"
  | "at_least_six_months"
  | "sudden_near_duplicate_burst_with_thin_signal"
  | "neutral";

export type ReciprocalEngagement =
  | "varied_specific_over_time"
  | "some_genuine_exchange"
  | "repeated_generic_pattern"
  | "neutral";

export type NetworkMaturity =
  | "plausible"
  | "under_30_established_senior_or_recruiter_with_thin_signal"
  | "neutral";

export type RecommendationEvidence =
  | "several_specific_across_people_and_time"
  | "some"
  | "repeated_boilerplate"
  | "neutral";

export type ContentSpecificity =
  | "concrete_technologies_projects_or_outcomes"
  | "wholly_generic_repeated"
  | "neutral";

export type ProfileImageEvidence = {
  kind: "personal" | "default_or_non_person" | "none";
  isNewProfile: boolean;
  isBroadlyThin: boolean;
};

/**
 * Structured facts read from LinkedIn's native "About this member" surface.
 *
 * No organization name, document value, profile identifier, URL, or dialog
 * text is retained. Employer text is compared transiently by the extractor and
 * reduced to the enum below before it enters the evidence model.
 */
export type VerificationDetailsEvidence = {
  /** Optional only for compatibility with evidence captured before model v2. */
  governmentId?: boolean;
  workplace: boolean;
  workplaceMatch?: "current" | "former_or_unresolved" | "none";
  education: boolean;
  /** Age of the oldest visible completed verification, if a date is shown. */
  verificationAgeDays?: number;
};

/** Days since each visible profile-maintenance event. Missing keys are neutral. */
export type ProfileMaintenanceEvidence = {
  contactUpdatedDays?: number;
  photoUpdatedDays?: number;
};

export interface ProfileEvidence {
  /** A generic native LinkedIn verification badge. It has zero score impact. */
  identityVerification: Observation<"active">;
  workplaceEducationVerification: Observation<VerificationDetailsEvidence>;
  accountAge: Observation<{ days: number }>;
  /** Optional during migration; absent callers are treated as unavailable. */
  profileMaintenance?: Observation<ProfileMaintenanceEvidence>;
  workHistoryDetail: Observation<WorkHistoryDetail>;
  careerChronology: Observation<CareerChronology>;
  crossSectionConsistency: Observation<CrossSectionConsistency>;
  companyAffiliation: Observation<CompanyAffiliation>;
  coreCompleteness: Observation<CoreCompleteness>;
  activityDistribution: Observation<ActivityDistribution>;
  reciprocalEngagement: Observation<ReciprocalEngagement>;
  networkMaturity: Observation<NetworkMaturity>;
  recommendations: Observation<RecommendationEvidence>;
  contentSpecificity: Observation<ContentSpecificity>;
  profileImage: Observation<ProfileImageEvidence>;
}

export type EvidenceField = keyof ProfileEvidence;

export function observedObservation<T>(
  value: T,
  source: string,
  extractionConfidence = 1,
): Observation<T> {
  return { state: "observed", value, extractionConfidence, source };
}

export function absentObservation(
  source: string,
  extractionConfidence = 1,
): NonObservedObservation {
  return { state: "absent", extractionConfidence, source };
}

export function unavailableObservation(
  source: string,
  extractionConfidence = 0,
): NonObservedObservation {
  return { state: "unavailable", extractionConfidence, source };
}

/** Creates a safe neutral input for a supported page with no usable evidence. */
export function createEmptyProfileEvidence(
  source = "not-extracted",
): ProfileEvidence {
  return {
    identityVerification: unavailableObservation(source),
    workplaceEducationVerification: unavailableObservation(source),
    accountAge: unavailableObservation(source),
    profileMaintenance: unavailableObservation(source),
    workHistoryDetail: unavailableObservation(source),
    careerChronology: unavailableObservation(source),
    crossSectionConsistency: unavailableObservation(source),
    companyAffiliation: unavailableObservation(source),
    coreCompleteness: unavailableObservation(source),
    activityDistribution: unavailableObservation(source),
    reciprocalEngagement: unavailableObservation(source),
    networkMaturity: unavailableObservation(source),
    recommendations: unavailableObservation(source),
    contentSpecificity: unavailableObservation(source),
    profileImage: unavailableObservation(source),
  };
}

// Compatibility type exports keep the evidence contract a single import point
// for content/UI code while the implementations remain split by responsibility.
export type { ScoreBand, ScoreResult } from "./evaluate";
export type { CriterionId, MessageKey } from "./rules-v2";
