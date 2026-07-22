import {
  absentObservation,
  observedObservation,
  type ProfileEvidence,
  type VerificationDetailsEvidence,
} from "../../src/scoring/evidence-schema";

const source = "fixture:calibration-v2";
const observed = <T>(value: T) => observedObservation(value, source);
const absent = <T>() => absentObservation(source) as ReturnType<typeof absentObservation>;

function neutralProfile(): ProfileEvidence {
  return {
    identityVerification: absent(),
    workplaceEducationVerification: observed({
      governmentId: false,
      workplace: false,
      workplaceMatch: "none",
      education: false,
    }),
    accountAge: absent(),
    profileMaintenance: absent(),
    workHistoryDetail: observed("neutral"),
    careerChronology: observed("neutral"),
    crossSectionConsistency: observed("neutral"),
    companyAffiliation: observed("neutral"),
    coreCompleteness: observed("neutral"),
    activityDistribution: observed("neutral"),
    reciprocalEngagement: observed("neutral"),
    networkMaturity: observed("neutral"),
    recommendations: observed("neutral"),
    contentSpecificity: observed("neutral"),
    profileImage: observed({ kind: "personal", isNewProfile: false, isBroadlyThin: false }),
  };
}

function establishedProfile(
  verification: VerificationDetailsEvidence,
  patch: Partial<ProfileEvidence> = {},
): ProfileEvidence {
  return {
    ...neutralProfile(),
    identityVerification: observed("active"),
    workplaceEducationVerification: observed(verification),
    accountAge: observed({ days: 4 * 365 }),
    profileMaintenance: observed({ contactUpdatedDays: 200, photoUpdatedDays: 700 }),
    workHistoryDetail: observed("several_substantive_dated_roles"),
    careerChronology: observed("consistent"),
    crossSectionConsistency: observed("partial_alignment"),
    companyAffiliation: observed("linked_employer_specific_role"),
    coreCompleteness: observed("adequate"),
    activityDistribution: observed("at_least_six_months"),
    reciprocalEngagement: observed("some_genuine_exchange"),
    networkMaturity: observed("plausible"),
    recommendations: observed("some"),
    contentSpecificity: observed("concrete_technologies_projects_or_outcomes"),
    ...patch,
  };
}

export interface CalibrationCase {
  id: string;
  category: "anchor" | "medium" | "new-private" | "negative-control";
  provenance: "user-supplied-anchor" | "labeled-example" | "synthetic-placeholder";
  evidence: ProfileEvidence;
  expected: readonly [minimum: number, maximum: number];
}

const currentWork: VerificationDetailsEvidence = {
  governmentId: false,
  workplace: true,
  workplaceMatch: "current",
  education: false,
  verificationAgeDays: 400,
};

const provisionalCalibrationCases: readonly Omit<CalibrationCase, "provenance">[] = [
  {
    id: "anchor-government-id-established",
    category: "anchor",
    evidence: establishedProfile({
      governmentId: true,
      workplace: false,
      workplaceMatch: "none",
      education: false,
      verificationAgeDays: 400,
    }, {
      accountAge: observed({ days: 8 * 365 }),
      careerChronology: observed("rich_coherent"),
      crossSectionConsistency: observed("strong_alignment"),
      coreCompleteness: observed("several_substantive_sections"),
      activityDistribution: observed("distributed_over_years"),
    }),
    expected: [96, 99],
  },
  {
    id: "anchor-current-workplace-longstanding-a",
    category: "anchor",
    evidence: establishedProfile(currentWork),
    expected: [92, 97],
  },
  {
    id: "anchor-current-workplace-longstanding-b",
    category: "anchor",
    evidence: establishedProfile(currentWork, {
      workHistoryDetail: observed("adequate"),
      careerChronology: observed("rich_coherent"),
    }),
    expected: [92, 97],
  },
  {
    id: "medium-established-unverified",
    category: "medium",
    evidence: establishedProfile({ governmentId: false, workplace: false, workplaceMatch: "none", education: false }, {
      accountAge: observed({ days: 7 * 365 }),
      profileMaintenance: absent(),
    }),
    expected: [82, 89],
  },
  {
    id: "medium-adequate-history",
    category: "medium",
    evidence: establishedProfile({ governmentId: false, workplace: false, workplaceMatch: "none", education: false }, {
      workHistoryDetail: observed("adequate"),
      companyAffiliation: observed("neutral"),
      reciprocalEngagement: observed("neutral"),
    }),
    expected: [70, 84],
  },
  {
    id: "medium-quiet-professional",
    category: "medium",
    evidence: establishedProfile({ governmentId: false, workplace: false, workplaceMatch: "none", education: false }, {
      activityDistribution: observed("neutral"),
      reciprocalEngagement: observed("neutral"),
      recommendations: observed("neutral"),
    }),
    expected: [70, 84],
  },
  {
    id: "medium-partial-alignment",
    category: "medium",
    evidence: establishedProfile({ governmentId: false, workplace: false, workplaceMatch: "none", education: false }, {
      careerChronology: observed("consistent"),
      crossSectionConsistency: observed("neutral"),
      coreCompleteness: observed("adequate"),
    }),
    expected: [68, 82],
  },
  {
    id: "new-private-minimal",
    category: "new-private",
    evidence: { ...neutralProfile(), accountAge: observed({ days: 90 }) },
    expected: [40, 55],
  },
  {
    id: "new-private-with-adequate-core",
    category: "new-private",
    evidence: {
      ...neutralProfile(),
      accountAge: observed({ days: 220 }),
      workHistoryDetail: observed("adequate"),
      coreCompleteness: observed("adequate"),
      contentSpecificity: observed("concrete_technologies_projects_or_outcomes"),
    },
    expected: [55, 65],
  },
  {
    id: "private-established-tenure-only",
    category: "new-private",
    evidence: { ...neutralProfile(), accountAge: observed({ days: 6 * 365 }) },
    expected: [55, 62],
  },
  {
    id: "student-one-year-consistent",
    category: "new-private",
    evidence: {
      ...neutralProfile(),
      accountAge: observed({ days: 365 }),
      coreCompleteness: observed("adequate"),
      contentSpecificity: observed("concrete_technologies_projects_or_outcomes"),
      networkMaturity: observed("plausible"),
    },
    expected: [54, 62],
  },
  {
    id: "negative-new-thin-burst",
    category: "negative-control",
    evidence: {
      ...neutralProfile(),
      accountAge: observed({ days: 5 }),
      workHistoryDetail: observed("established_empty_or_vague"),
      coreCompleteness: observed("three_or_more_confirmed_empty"),
      activityDistribution: observed("sudden_near_duplicate_burst_with_thin_signal"),
      networkMaturity: observed("under_30_established_senior_or_recruiter_with_thin_signal"),
      profileImage: observed({ kind: "default_or_non_person", isNewProfile: true, isBroadlyThin: true }),
    },
    expected: [5, 25],
  },
  {
    id: "negative-contradictory-history",
    category: "negative-control",
    evidence: {
      ...neutralProfile(),
      careerChronology: observed("material_contradiction"),
      crossSectionConsistency: observed("material_conflict"),
      companyAffiliation: observed("material_identity_conflict"),
      contentSpecificity: observed("wholly_generic_repeated"),
    },
    expected: [10, 35],
  },
  {
    id: "negative-generic-social-pattern",
    category: "negative-control",
    evidence: {
      ...neutralProfile(),
      accountAge: observed({ days: 80 }),
      reciprocalEngagement: observed("repeated_generic_pattern"),
      recommendations: observed("repeated_boilerplate"),
      contentSpecificity: observed("wholly_generic_repeated"),
      networkMaturity: observed("under_30_established_senior_or_recruiter_with_thin_signal"),
    },
    expected: [30, 45],
  },
  {
    id: "negative-verified-but-contradictory",
    category: "negative-control",
    evidence: {
      ...establishedProfile({
        governmentId: true,
        workplace: false,
        workplaceMatch: "none",
        education: false,
        verificationAgeDays: 500,
      }),
      careerChronology: observed("material_contradiction"),
      crossSectionConsistency: observed("material_conflict"),
    },
    expected: [45, 64],
  },
  {
    id: "negative-potentially-compromised-old-account",
    category: "negative-control",
    evidence: {
      ...establishedProfile(currentWork),
      accountAge: observed({ days: 10 * 365 }),
      companyAffiliation: observed("material_identity_conflict"),
      activityDistribution: observed("sudden_near_duplicate_burst_with_thin_signal"),
      reciprocalEngagement: observed("repeated_generic_pattern"),
    },
    expected: [50, 64],
  },
];

/**
 * The three anchors reflect the user's supplied expectations. The remaining
 * cases exercise the model shape but are explicitly marked as synthetic; they
 * cannot satisfy the public-release calibration gate by themselves.
 */
export const calibrationCases: readonly CalibrationCase[] = provisionalCalibrationCases.map(
  (fixture) => ({
    ...fixture,
    provenance: fixture.category === "anchor"
      ? "user-supplied-anchor"
      : "synthetic-placeholder",
  }),
);

export function releaseCalibrationGateSatisfied(
  cases: readonly CalibrationCase[] = calibrationCases,
): boolean {
  const count = (category: CalibrationCase["category"]): number =>
    cases.filter((fixture) => fixture.category === category).length;
  return (
    count("anchor") >= 3 &&
    count("medium") >= 4 &&
    count("new-private") >= 4 &&
    count("negative-control") >= 4 &&
    cases.filter((fixture) => fixture.category === "anchor")
      .every((fixture) => fixture.provenance === "user-supplied-anchor") &&
    cases.filter((fixture) => fixture.category !== "anchor")
      .every((fixture) => fixture.provenance === "labeled-example")
  );
}
