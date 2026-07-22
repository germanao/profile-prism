import type { ProfileEvidence } from "./evidence-schema";
import {
  buildExplanationGroups,
  sortContributions,
  type CriterionContribution,
  type ExplanationGroups,
  type UnavailableCriterion,
} from "./explanations";
import {
  CRITERIA_V2,
  MODEL_VERSION,
  SCORE_BASELINE,
  SCORE_MAX,
  SCORE_MIN,
  TOTAL_CRITERION_WEIGHT,
  evaluateRule,
  hasExplicitVerificationMethod,
  hasMaterialConflict,
  type MessageKey,
} from "./rules-v2";

export type CoverageLevel = "very-low" | "low" | "partial" | "high";

export type ScoreBand =
  | "several-caution-signals"
  | "inconclusive"
  | "more-supporting-signals"
  | "strong-supporting-signals";

export type BadgeTreatment = "neutral" | "partial" | "score-band";

export type ScoreCalculation = {
  baseline: typeof SCORE_BASELINE;
  contributionTotal: number;
  unroundedScore: number;
  roundedScore: number;
  roundingAdjustment: number;
  rangeAdjustment: number;
  safeguardAdjustment: number;
  finalScore: number;
};

export type ScoreResult = {
  modelVersion: typeof MODEL_VERSION;
  score: number;
  /** Exact model coverage in the inclusive 0..1 range. */
  coverage: number;
  /** Floored to avoid visually overstating evidence near a threshold. */
  coveragePercent: number;
  coverageLevel: CoverageLevel;
  scoreBand: ScoreBand;
  presentation: {
    treatment: BadgeTreatment;
    neutral: boolean;
    showBandInterpretation: boolean;
    insufficientEvidence: boolean;
  };
  contributions: CriterionContribution[];
  explanations: ExplanationGroups;
  calculation: ScoreCalculation;
};

export type EvaluationOptions = {
  /** True only after the user-initiated full visible-profile scan settles. */
  fullScanCompleted?: boolean;
  /** True only when that scan successfully parsed the native member dialog. */
  verificationDetailsInspected?: boolean;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeConfidence(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0;
  return clamp(confidence, 0, 1);
}

function floorCoveragePercent(coveredWeight: number): number {
  const nearestInteger = Math.round(coveredWeight);
  const floatingPointTolerance =
    Number.EPSILON * Math.max(1, Math.abs(coveredWeight)) * 64;
  const normalized =
    Math.abs(coveredWeight - nearestInteger) <= floatingPointTolerance
      ? nearestInteger
      : coveredWeight;
  return Math.min(100, Math.floor(normalized));
}

function unavailableKey(criterion: string): MessageKey {
  return `criterion.${criterion}.unavailable` as MessageKey;
}

export function classifyCoverage(coverage: number): CoverageLevel {
  if (coverage < 0.25) return "very-low";
  if (coverage < 0.4) return "low";
  if (coverage < 0.7) return "partial";
  return "high";
}

export function classifyScoreBand(score: number): ScoreBand {
  if (score <= 34) return "several-caution-signals";
  if (score <= 64) return "inconclusive";
  if (score <= 84) return "more-supporting-signals";
  return "strong-supporting-signals";
}

/** Exported so the safety invariant can be tested independently of model weights. */
export function applyCautionFamilySafeguard(
  score: number,
  cautionFamilyCount: number,
): number {
  return score < 35 && cautionFamilyCount < 2 ? 35 : score;
}

export function evaluateProfileEvidence(
  evidence: ProfileEvidence,
  options: EvaluationOptions = {},
): ScoreResult {
  if (TOTAL_CRITERION_WEIGHT !== 100) {
    throw new Error(
      `Invalid ${MODEL_VERSION} rules: criterion weights total ${TOTAL_CRITERION_WEIGHT}, expected 100.`,
    );
  }

  let coveredWeight = 0;
  const contributions: CriterionContribution[] = [];
  const unavailable: UnavailableCriterion[] = [];

  for (const definition of CRITERIA_V2) {
    const observation = evidence[definition.evidenceField] ?? {
      state: "unavailable" as const,
      extractionConfidence: 0,
      source: "model:missing-migration-field",
    };
    const rule = evaluateRule(definition.id, evidence);
    const normalizedConfidence = normalizeConfidence(
      observation.extractionConfidence,
    );

    let confidence = normalizedConfidence;
    let unavailableReason: UnavailableCriterion["reason"] | undefined;

    if (observation.state === "unavailable") {
      confidence = 0;
      unavailableReason = "unavailable";
    } else if (!rule.usable) {
      confidence = 0;
      unavailableReason = "invalid";
    } else if (confidence === 0) {
      unavailableReason = "zero-confidence";
    }

    if (unavailableReason) {
      unavailable.push({
        criterion: definition.id,
        weight: definition.weight,
        messageKey: unavailableKey(definition.id),
        reason: unavailableReason,
      });
      continue;
    }

    coveredWeight += definition.weight * confidence;
    const scoreImpact = rule.impact * confidence;

    if (scoreImpact !== 0 || rule.explain) {
      contributions.push({
        criterion: definition.id,
        family: definition.family,
        weight: definition.weight,
        signal: rule.signal,
        confidence,
        scoreImpact,
        messageKey: rule.messageKey,
      });
    }
  }

  const orderedContributions = sortContributions(contributions);
  const contributionTotal = orderedContributions.reduce(
    (total, contribution) => total + contribution.scoreImpact,
    0,
  );
  const unroundedScore = SCORE_BASELINE + contributionTotal;
  const roundedScore = Math.round(unroundedScore);
  const roundingAdjustment = roundedScore - unroundedScore;
  const rangeLimitedScore = clamp(roundedScore, SCORE_MIN, SCORE_MAX);
  const rangeAdjustment = rangeLimitedScore - roundedScore;
  const cautionFamilies = new Set(
    orderedContributions
      .filter(({ scoreImpact }) => scoreImpact < 0)
      .map(({ family }) => family),
  );
  let finalScore = applyCautionFamilySafeguard(
    rangeLimitedScore,
    cautionFamilies.size,
  );

  const coverage = clamp(
    coveredWeight / TOTAL_CRITERION_WEIGHT,
    0,
    1,
  );

  // Model-v2 caps prevent an impressive but incompletely inspected profile
  // from presenting as near-certain. Missing evidence never subtracts points;
  // it only limits how strongly the result may be stated.
  if (coverage < 0.4) finalScore = Math.min(finalScore, 64);
  else if (coverage < 0.7) finalScore = Math.min(finalScore, 84);

  const explicitVerification = hasExplicitVerificationMethod(evidence);
  if (evidence.identityVerification.state === "observed" && !explicitVerification) {
    finalScore = Math.min(finalScore, 89);
  }
  const materialConflict = hasMaterialConflict(evidence);
  if (materialConflict) finalScore = Math.min(finalScore, 64);

  const tenureOrActivity =
    (evidence.accountAge.state === "observed" && evidence.accountAge.value.days >= 2 * 365) ||
    (evidence.activityDistribution.state === "observed" &&
      (evidence.activityDistribution.value === "at_least_six_months" ||
        evidence.activityDistribution.value === "distributed_over_years"));
  const positiveNonVerificationFamilies = new Set(
    orderedContributions
      .filter(({ scoreImpact, family }) => scoreImpact > 0 && family !== "verification")
      .map(({ family }) => family),
  ).size;
  const highScoreRequirementsMet =
    options.fullScanCompleted === true &&
    options.verificationDetailsInspected === true &&
    coverage >= 0.7 &&
    explicitVerification &&
    tenureOrActivity &&
    positiveNonVerificationFamilies >= 3 &&
    !materialConflict;
  if (finalScore > 89 && !highScoreRequirementsMet) finalScore = 89;
  finalScore = clamp(finalScore, SCORE_MIN, SCORE_MAX);
  const safeguardAdjustment = finalScore - rangeLimitedScore;
  const level = classifyCoverage(coverage);
  const insufficientEvidence = coverage < 0.4;
  const showBandInterpretation = coverage >= 0.7;
  const treatment: BadgeTreatment = insufficientEvidence
    ? "neutral"
    : showBandInterpretation
      ? "score-band"
      : "partial";

  return {
    modelVersion: MODEL_VERSION,
    score: finalScore,
    coverage,
    coveragePercent: floorCoveragePercent(coveredWeight),
    coverageLevel: level,
    scoreBand: classifyScoreBand(finalScore),
    presentation: {
      treatment,
      neutral: insufficientEvidence,
      showBandInterpretation,
      insufficientEvidence,
    },
    contributions: orderedContributions,
    explanations: buildExplanationGroups(orderedContributions, unavailable),
    calculation: {
      baseline: SCORE_BASELINE,
      contributionTotal,
      unroundedScore,
      roundedScore,
      roundingAdjustment,
      rangeAdjustment,
      safeguardAdjustment,
      finalScore,
    },
  };
}
