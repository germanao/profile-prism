import type {
  NonObservedObservation,
  ProfileEvidence,
  ProfileImageEvidence,
  ProfileMaintenanceEvidence,
  VerificationDetailsEvidence,
} from "./evidence-schema";

export const MODEL_VERSION = "profile-evidence-v2" as const;
export const SCORE_BASELINE = 50 as const;
export const SCORE_MIN = 5 as const;
export const SCORE_MAX = 99 as const;

/** Coverage weights are intentionally independent from score-point impacts. */
export const CRITERIA_V2 = [
  { id: "identity-verification", evidenceField: "identityVerification", weight: 2, family: "verification" },
  { id: "affiliation-verification", evidenceField: "workplaceEducationVerification", weight: 14, family: "verification" },
  { id: "account-age", evidenceField: "accountAge", weight: 10, family: "account-tenure" },
  { id: "profile-maintenance", evidenceField: "profileMaintenance", weight: 4, family: "profile-maintenance" },
  { id: "work-history-detail", evidenceField: "workHistoryDetail", weight: 12, family: "professional-history" },
  { id: "career-chronology", evidenceField: "careerChronology", weight: 10, family: "professional-history" },
  { id: "cross-section-consistency", evidenceField: "crossSectionConsistency", weight: 10, family: "profile-consistency" },
  { id: "company-affiliation", evidenceField: "companyAffiliation", weight: 7, family: "profile-consistency" },
  { id: "core-completeness", evidenceField: "coreCompleteness", weight: 8, family: "profile-depth" },
  { id: "activity-distribution", evidenceField: "activityDistribution", weight: 7, family: "activity" },
  { id: "reciprocal-engagement", evidenceField: "reciprocalEngagement", weight: 5, family: "activity" },
  { id: "network-maturity", evidenceField: "networkMaturity", weight: 4, family: "social-proof" },
  { id: "recommendations", evidenceField: "recommendations", weight: 3, family: "social-proof" },
  { id: "content-specificity", evidenceField: "contentSpecificity", weight: 3, family: "content" },
  { id: "profile-image", evidenceField: "profileImage", weight: 1, family: "image" },
] as const;

export type CriterionDefinition = (typeof CRITERIA_V2)[number];
export type CriterionId = CriterionDefinition["id"];
export type SignalFamily = CriterionDefinition["family"];
export type MessageKey = `criterion.${CriterionId}.${string}`;

export type RuleEvaluation = {
  /** Direct point impact before extraction-confidence scaling. */
  impact: number;
  /** Normalized direction retained for presentation/backward compatibility. */
  signal: number;
  messageKey: MessageKey;
  usable: boolean;
  /** Include a zero-point fact in the informational explanation group. */
  explain: boolean;
};

export const TOTAL_CRITERION_WEIGHT = CRITERIA_V2.reduce(
  (total, criterion) => total + criterion.weight,
  0,
);

function messageKey(criterion: CriterionId, suffix: string): MessageKey {
  return `criterion.${criterion}.${suffix}`;
}

function fixed(
  criterion: CriterionId,
  suffix: string,
  impact: number,
  maximumMagnitude: number,
  explain = impact !== 0,
): RuleEvaluation {
  return {
    impact,
    signal: maximumMagnitude === 0
      ? 0
      : Math.max(-1, Math.min(1, impact / maximumMagnitude)),
    messageKey: messageKey(criterion, suffix),
    usable: true,
    explain,
  };
}

function nonObserved(
  criterion: CriterionId,
  observation: NonObservedObservation | undefined,
): RuleEvaluation {
  const state = observation?.state ?? "unavailable";
  return {
    impact: 0,
    signal: 0,
    messageKey: messageKey(criterion, state),
    usable: state === "absent",
    explain: false,
  };
}

function malformed(criterion: CriterionId): RuleEvaluation {
  return {
    impact: 0,
    signal: 0,
    messageKey: messageKey(criterion, "unavailable"),
    usable: false,
    explain: false,
  };
}

function nativeVerificationBadge(
  observation: ProfileEvidence["identityVerification"],
): RuleEvaluation {
  const criterion = "identity-verification" as const;
  if (observation.state !== "observed") return nonObserved(criterion, observation);
  if (observation.value !== "active") return malformed(criterion);
  return fixed(criterion, "badge-visible-neutral", 0, 0, true);
}

function validVerificationDetails(value: VerificationDetailsEvidence): boolean {
  return (
    (value.governmentId === undefined || typeof value.governmentId === "boolean") &&
    typeof value.workplace === "boolean" &&
    typeof value.education === "boolean" &&
    (value.workplaceMatch === undefined ||
      value.workplaceMatch === "current" ||
      value.workplaceMatch === "former_or_unresolved" ||
      value.workplaceMatch === "none") &&
    (value.verificationAgeDays === undefined ||
      (Number.isFinite(value.verificationAgeDays) && value.verificationAgeDays >= 0))
  );
}

function verificationDetails(
  observation: ProfileEvidence["workplaceEducationVerification"],
): RuleEvaluation {
  const criterion = "affiliation-verification" as const;
  if (observation.state !== "observed") return nonObserved(criterion, observation);
  if (!validVerificationDetails(observation.value)) return malformed(criterion);

  const value = observation.value;
  const methodImpacts = [
    value.governmentId ? 12 : 0,
    value.workplace ? (value.workplaceMatch === "current" ? 10 : 6) : 0,
    value.education ? 5 : 0,
  ];
  const methodImpact = Math.min(15, methodImpacts.reduce((sum, impact) => sum + impact, 0));
  const ageBonus = value.verificationAgeDays === undefined
    ? 0
    : value.verificationAgeDays >= 365
      ? 2
      : value.verificationAgeDays >= 180
        ? 1
        : 0;
  const impact = methodImpact + ageBonus;
  if (impact === 0) return fixed(criterion, "no-explicit-method", 0, 17, false);

  const methods = [
    value.governmentId ? "government-id" : "",
    value.workplace ? (value.workplaceMatch === "current" ? "current-workplace" : "workplace") : "",
    value.education ? "education" : "",
  ].filter(Boolean).join("+");
  const maintained = ageBonus === 2 ? "+maintained-12-months" : ageBonus === 1 ? "+maintained-6-months" : "";
  return fixed(criterion, `${methods}${maintained}`, impact, 17);
}

function accountAge(observation: ProfileEvidence["accountAge"]): RuleEvaluation {
  const criterion = "account-age" as const;
  if (observation.state !== "observed") return nonObserved(criterion, observation);
  const days = observation.value.days;
  if (!Number.isFinite(days) || days < 0) return malformed(criterion);
  if (days < 30) return fixed(criterion, "under-30-days", -8, 8);
  if (days < 180) return fixed(criterion, "30-to-179-days", -4, 8);
  if (days < 2 * 365) return fixed(criterion, "180-days-to-2-years", 1, 8);
  if (days < 5 * 365) return fixed(criterion, "2-to-5-years", 4, 8);
  return fixed(criterion, "over-5-years", 8, 8);
}

function validMaintenance(value: ProfileMaintenanceEvidence): boolean {
  return [value.contactUpdatedDays, value.photoUpdatedDays].every(
    (days) => days === undefined || (Number.isFinite(days) && days >= 0),
  );
}

function profileMaintenance(
  observation: ProfileEvidence["profileMaintenance"],
): RuleEvaluation {
  const criterion = "profile-maintenance" as const;
  if (!observation || observation.state !== "observed") {
    return nonObserved(criterion, observation);
  }
  if (!validMaintenance(observation.value)) return malformed(criterion);
  const recent = [observation.value.contactUpdatedDays, observation.value.photoUpdatedDays]
    .filter((days): days is number => days !== undefined && days <= 365).length;
  if (recent === 2) return fixed(criterion, "contact-and-photo-within-one-year", 2, 2);
  if (recent === 1) return fixed(criterion, "one-field-within-one-year", 1, 2);
  return fixed(criterion, "updates-older-or-not-shown", 0, 2, false);
}

function enumRule<T extends string>(
  criterion: CriterionId,
  observation: { state: "observed"; value: T } | NonObservedObservation,
  impacts: Readonly<Record<T, number>>,
  maximumMagnitude: number,
): RuleEvaluation {
  if (observation.state !== "observed") return nonObserved(criterion, observation);
  const impact = impacts[observation.value];
  if (typeof impact !== "number") return malformed(criterion);
  return fixed(criterion, observation.value, impact, maximumMagnitude);
}

function isProfileImageEvidence(value: unknown): value is ProfileImageEvidence {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ProfileImageEvidence>;
  return (
    (candidate.kind === "personal" || candidate.kind === "default_or_non_person" || candidate.kind === "none") &&
    typeof candidate.isNewProfile === "boolean" &&
    typeof candidate.isBroadlyThin === "boolean"
  );
}

function profileImage(observation: ProfileEvidence["profileImage"]): RuleEvaluation {
  const criterion = "profile-image" as const;
  if (observation.state !== "observed") return nonObserved(criterion, observation);
  if (!isProfileImageEvidence(observation.value)) return malformed(criterion);
  if (
    observation.value.kind === "default_or_non_person" &&
    observation.value.isNewProfile &&
    observation.value.isBroadlyThin
  ) {
    return fixed(criterion, "default-new-and-thin", -4, 4);
  }
  return fixed(criterion, "neutral", 0, 4, false);
}

export function evaluateRule(
  criterion: CriterionId,
  evidence: ProfileEvidence,
): RuleEvaluation {
  switch (criterion) {
    case "identity-verification":
      return nativeVerificationBadge(evidence.identityVerification);
    case "affiliation-verification":
      return verificationDetails(evidence.workplaceEducationVerification);
    case "account-age":
      return accountAge(evidence.accountAge);
    case "profile-maintenance":
      return profileMaintenance(evidence.profileMaintenance);
    case "work-history-detail":
      return enumRule(criterion, evidence.workHistoryDetail, {
        several_substantive_dated_roles: 9,
        adequate: 4,
        established_empty_or_vague: -10,
        neutral: 0,
      }, 10);
    case "career-chronology":
      return enumRule(criterion, evidence.careerChronology, {
        rich_coherent: 8,
        consistent: 3,
        material_contradiction: -12,
        neutral: 0,
      }, 12);
    case "cross-section-consistency":
      return enumRule(criterion, evidence.crossSectionConsistency, {
        strong_alignment: 7,
        partial_alignment: 3,
        material_conflict: -12,
        neutral: 0,
      }, 12);
    case "company-affiliation":
      return enumRule(criterion, evidence.companyAffiliation, {
        linked_employer_specific_role: 4,
        material_identity_conflict: -10,
        neutral: 0,
      }, 10);
    case "core-completeness":
      return enumRule(criterion, evidence.coreCompleteness, {
        several_substantive_sections: 5,
        adequate: 2,
        three_or_more_confirmed_empty: -8,
        neutral: 0,
      }, 8);
    case "activity-distribution":
      return enumRule(criterion, evidence.activityDistribution, {
        distributed_over_years: 4,
        at_least_six_months: 2,
        sudden_near_duplicate_burst_with_thin_signal: -7,
        neutral: 0,
      }, 7);
    case "reciprocal-engagement":
      return enumRule(criterion, evidence.reciprocalEngagement, {
        varied_specific_over_time: 2,
        some_genuine_exchange: 1,
        repeated_generic_pattern: -4,
        neutral: 0,
      }, 4);
    case "network-maturity":
      return enumRule(criterion, evidence.networkMaturity, {
        plausible: 1,
        under_30_established_senior_or_recruiter_with_thin_signal: -4,
        neutral: 0,
      }, 4);
    case "recommendations":
      return enumRule(criterion, evidence.recommendations, {
        several_specific_across_people_and_time: 2,
        some: 1,
        repeated_boilerplate: -3,
        neutral: 0,
      }, 3);
    case "content-specificity":
      return enumRule(criterion, evidence.contentSpecificity, {
        concrete_technologies_projects_or_outcomes: 2,
        wholly_generic_repeated: -2,
        neutral: 0,
      }, 2);
    case "profile-image":
      return profileImage(evidence.profileImage);
  }
}

export function hasExplicitVerificationMethod(evidence: ProfileEvidence): boolean {
  const observation = evidence.workplaceEducationVerification;
  return observation.state === "observed" && Boolean(
    observation.value.governmentId || observation.value.workplace || observation.value.education,
  );
}

export function hasMaterialConflict(evidence: ProfileEvidence): boolean {
  return (
    (evidence.careerChronology.state === "observed" && evidence.careerChronology.value === "material_contradiction") ||
    (evidence.crossSectionConsistency.state === "observed" && evidence.crossSectionConsistency.value === "material_conflict") ||
    (evidence.companyAffiliation.state === "observed" && evidence.companyAffiliation.value === "material_identity_conflict")
  );
}
