import { describe, expect, it } from "vitest";
import {
  absentObservation,
  createEmptyProfileEvidence,
  observedObservation,
  unavailableObservation,
  type ProfileEvidence,
} from "../../src/scoring/evidence-schema";
import {
  applyCautionFamilySafeguard,
  classifyCoverage,
  evaluateProfileEvidence,
} from "../../src/scoring/evaluate";
import {
  CRITERIA_V2,
  MODEL_VERSION,
  SCORE_MAX,
  TOTAL_CRITERION_WEIGHT,
  evaluateRule,
} from "../../src/scoring/rules-v2";

const source = "fixture:model-v2";

function evidence(patch: Partial<ProfileEvidence> = {}): ProfileEvidence {
  return { ...createEmptyProfileEvidence(source), ...patch };
}

function fullyInspectedNeutral(): ProfileEvidence {
  return {
    identityVerification: absentObservation(source),
    workplaceEducationVerification: observedObservation(
      { governmentId: false, workplace: false, workplaceMatch: "none", education: false },
      source,
    ),
    accountAge: absentObservation(source),
    profileMaintenance: absentObservation(source),
    workHistoryDetail: observedObservation("neutral", source),
    careerChronology: observedObservation("neutral", source),
    crossSectionConsistency: observedObservation("neutral", source),
    companyAffiliation: observedObservation("neutral", source),
    coreCompleteness: observedObservation("neutral", source),
    activityDistribution: observedObservation("neutral", source),
    reciprocalEngagement: observedObservation("neutral", source),
    networkMaturity: observedObservation("neutral", source),
    recommendations: observedObservation("neutral", source),
    contentSpecificity: observedObservation("neutral", source),
    profileImage: observedObservation(
      { kind: "personal", isNewProfile: false, isBroadlyThin: false },
      source,
    ),
  };
}

function strongestSupporting(): ProfileEvidence {
  return {
    identityVerification: observedObservation("active", source),
    workplaceEducationVerification: observedObservation(
      {
        governmentId: true,
        workplace: true,
        workplaceMatch: "current",
        education: true,
        verificationAgeDays: 500,
      },
      source,
    ),
    accountAge: observedObservation({ days: 8 * 365 }, source),
    profileMaintenance: observedObservation(
      { contactUpdatedDays: 20, photoUpdatedDays: 300 },
      source,
    ),
    workHistoryDetail: observedObservation("several_substantive_dated_roles", source),
    careerChronology: observedObservation("rich_coherent", source),
    crossSectionConsistency: observedObservation("strong_alignment", source),
    companyAffiliation: observedObservation("linked_employer_specific_role", source),
    coreCompleteness: observedObservation("several_substantive_sections", source),
    activityDistribution: observedObservation("distributed_over_years", source),
    reciprocalEngagement: observedObservation("varied_specific_over_time", source),
    networkMaturity: observedObservation("plausible", source),
    recommendations: observedObservation("several_specific_across_people_and_time", source),
    contentSpecificity: observedObservation("concrete_technologies_projects_or_outcomes", source),
    profileImage: observedObservation(
      { kind: "personal", isNewProfile: false, isBroadlyThin: false },
      source,
    ),
  };
}

describe("profile-evidence-v2 contract", () => {
  it("uses the approved independent coverage weights", () => {
    expect(MODEL_VERSION).toBe("profile-evidence-v2");
    expect(SCORE_MAX).toBe(99);
    expect(TOTAL_CRITERION_WEIGHT).toBe(100);
    expect(CRITERIA_V2.map(({ id, weight }) => [id, weight])).toEqual([
      ["identity-verification", 2],
      ["affiliation-verification", 14],
      ["account-age", 10],
      ["profile-maintenance", 4],
      ["work-history-detail", 12],
      ["career-chronology", 10],
      ["cross-section-consistency", 10],
      ["company-affiliation", 7],
      ["core-completeness", 8],
      ["activity-distribution", 7],
      ["reciprocal-engagement", 5],
      ["network-maturity", 4],
      ["recommendations", 3],
      ["content-specificity", 3],
      ["profile-image", 1],
    ]);
  });

  it("creates no raw identity, URL, organization, or dialog-text field", () => {
    const empty = createEmptyProfileEvidence();
    expect(Object.keys(empty)).toHaveLength(15);
    for (const excluded of ["name", "url", "profileId", "organization", "dialogText", "documentId"]) {
      expect(empty).not.toHaveProperty(excluded);
    }
  });

  it("treats the generic native badge as informational and worth zero points", () => {
    const result = evaluateProfileEvidence(evidence({
      identityVerification: observedObservation("active", source),
    }));
    expect(result.score).toBe(50);
    expect(result.coveragePercent).toBe(2);
    expect(result.explanations.supporting).toHaveLength(0);
    expect(result.explanations.informational).toMatchObject([
      { criterion: "identity-verification", scoreImpact: 0 },
    ]);
  });

  it.each([
    [{ governmentId: true, workplace: false, workplaceMatch: "none", education: false }, 12],
    [{ governmentId: false, workplace: true, workplaceMatch: "current", education: false }, 10],
    [{ governmentId: false, workplace: true, workplaceMatch: "former_or_unresolved", education: false }, 6],
    [{ governmentId: false, workplace: false, workplaceMatch: "none", education: true }, 5],
    [{ governmentId: true, workplace: true, workplaceMatch: "current", education: true }, 15],
    [{ governmentId: true, workplace: false, workplaceMatch: "none", education: false, verificationAgeDays: 200 }, 13],
    [{ governmentId: true, workplace: false, workplaceMatch: "none", education: false, verificationAgeDays: 400 }, 14],
  ] as const)("maps structured verification details to %i direct points", (value, impact) => {
    expect(evaluateRule("affiliation-verification", evidence({
      workplaceEducationVerification: observedObservation(value, source),
    })).impact).toBe(impact);
  });

  it.each([
    [2, -8],
    [60, -4],
    [200, 1],
    [2 * 365, 4],
    [3 * 365, 4],
    [5 * 365 - 1, 4],
    [5 * 365, 8],
    [6 * 365, 8],
  ])("maps account tenure of %i days to %i points", (days, impact) => {
    expect(evaluateRule("account-age", evidence({
      accountAge: observedObservation({ days }, source),
    })).impact).toBe(impact);
  });

  it("credits only maintenance updates within one year", () => {
    expect(evaluateRule("profile-maintenance", evidence({
      profileMaintenance: observedObservation(
        { contactUpdatedDays: 30, photoUpdatedDays: 365 },
        source,
      ),
    })).impact).toBe(2);
    expect(evaluateRule("profile-maintenance", evidence({
      profileMaintenance: observedObservation(
        { contactUpdatedDays: 366, photoUpdatedDays: 800 },
        source,
      ),
    })).impact).toBe(0);
  });

  it("scales direct impact by confidence without changing its coverage weight", () => {
    const result = evaluateProfileEvidence(evidence({
      workHistoryDetail: observedObservation(
        "several_substantive_dated_roles",
        source,
        0.5,
      ),
    }));
    expect(result.calculation.contributionTotal).toBe(4.5);
    expect(result.coveragePercent).toBe(6);
    expect(result.score).toBe(55);
  });
});

describe("model-v2 safeguards", () => {
  it("requires both a completed scan and inspected native details for scores above 89", () => {
    expect(evaluateProfileEvidence(strongestSupporting()).score).toBe(89);
    expect(evaluateProfileEvidence(strongestSupporting(), {
      fullScanCompleted: true,
    }).score).toBe(89);
    expect(evaluateProfileEvidence(strongestSupporting(), {
      fullScanCompleted: true,
      verificationDetailsInspected: true,
    }).score).toBe(99);
  });

  it("caps low and partial coverage without subtracting for unavailable checks", () => {
    const low = evaluateProfileEvidence(evidence({
      workplaceEducationVerification: observedObservation(
        { governmentId: true, workplace: false, workplaceMatch: "none", education: false },
        source,
      ),
      workHistoryDetail: observedObservation("several_substantive_dated_roles", source),
      careerChronology: observedObservation("rich_coherent", source),
    }), { fullScanCompleted: true, verificationDetailsInspected: true });
    expect(low.coverage).toBeLessThan(0.4);
    expect(low.score).toBe(64);

    const partial = evaluateProfileEvidence(evidence({
      workplaceEducationVerification: observedObservation(
        { governmentId: true, workplace: false, workplaceMatch: "none", education: false },
        source,
      ),
      accountAge: observedObservation({ days: 8 * 365 }, source),
      workHistoryDetail: observedObservation("several_substantive_dated_roles", source),
      careerChronology: observedObservation("rich_coherent", source),
      crossSectionConsistency: observedObservation("strong_alignment", source),
      coreCompleteness: observedObservation("several_substantive_sections", source),
    }), { fullScanCompleted: true, verificationDetailsInspected: true });
    expect(partial.coverage).toBeGreaterThanOrEqual(0.4);
    expect(partial.coverage).toBeLessThan(0.7);
    expect(partial.score).toBe(84);
  });

  it("caps a generic badge without dialog-derived details at 89", () => {
    const profile = strongestSupporting();
    profile.workplaceEducationVerification = unavailableObservation(source);
    const result = evaluateProfileEvidence(profile, {
      fullScanCompleted: true,
      verificationDetailsInspected: true,
    });
    expect(result.coveragePercent).toBe(86);
    expect(result.score).toBe(89);
  });

  it("caps any material chronology, employer, or cross-section conflict at 64", () => {
    const profile = strongestSupporting();
    profile.crossSectionConsistency = observedObservation("material_conflict", source);
    expect(evaluateProfileEvidence(profile, {
      fullScanCompleted: true,
      verificationDetailsInspected: true,
    }).score).toBe(64);
  });

  it("requires tenure/activity and three positive non-verification families for >89", () => {
    const profile = fullyInspectedNeutral();
    profile.workplaceEducationVerification = observedObservation(
      { governmentId: true, workplace: false, workplaceMatch: "none", education: false },
      source,
    );
    profile.workHistoryDetail = observedObservation("several_substantive_dated_roles", source);
    profile.careerChronology = observedObservation("rich_coherent", source);
    profile.crossSectionConsistency = observedObservation("strong_alignment", source);
    profile.coreCompleteness = observedObservation("several_substantive_sections", source);
    expect(evaluateProfileEvidence(profile, {
      fullScanCompleted: true,
      verificationDetailsInspected: true,
    }).score).toBe(89);
  });

  it("retains the independent-caution-family floor", () => {
    expect(applyCautionFamilySafeguard(10, 1)).toBe(35);
    expect(applyCautionFamilySafeguard(10, 2)).toBe(10);
  });

  it.each([
    [0, "very-low"], [0.25, "low"], [0.4, "partial"], [0.7, "high"], [1, "high"],
  ] as const)("classifies coverage %f as %s", (coverage, level) => {
    expect(classifyCoverage(coverage)).toBe(level);
  });

  it("keeps score and coverage bounded", () => {
    for (const profile of [createEmptyProfileEvidence(), fullyInspectedNeutral(), strongestSupporting()]) {
      const result = evaluateProfileEvidence(profile, {
        fullScanCompleted: true,
        verificationDetailsInspected: true,
      });
      expect(result.score).toBeGreaterThanOrEqual(5);
      expect(result.score).toBeLessThanOrEqual(99);
      expect(result.coverage).toBeGreaterThanOrEqual(0);
      expect(result.coverage).toBeLessThanOrEqual(1);
      expect(evaluateProfileEvidence(profile, {
        fullScanCompleted: true,
        verificationDetailsInspected: true,
      })).toEqual(result);
    }
  });
});
