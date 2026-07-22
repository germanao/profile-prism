import {
  CRITERIA_V2,
  type CriterionId,
  type MessageKey,
  type SignalFamily,
} from "./rules-v2";

export type CriterionContribution = {
  criterion: CriterionId;
  family: SignalFamily;
  weight: number;
  signal: number;
  confidence: number;
  /** Direct model-v2 point impact after extraction-confidence scaling. */
  scoreImpact: number;
  messageKey: MessageKey;
};

export type Explanation = {
  criterion: CriterionId;
  family: SignalFamily;
  messageKey: MessageKey;
  scoreImpact: number;
};

export type UnavailableCriterion = {
  criterion: CriterionId;
  weight: number;
  messageKey: MessageKey;
  reason: "unavailable" | "invalid" | "zero-confidence";
};

export type ExplanationGroups = {
  supporting: Explanation[];
  caution: Explanation[];
  /** Visible, inspected facts that intentionally have zero score impact. */
  informational: Explanation[];
  unavailable: UnavailableCriterion[];
};

const criterionOrder = new Map<CriterionId, number>(
  CRITERIA_V2.map((criterion, index) => [criterion.id, index]),
);

function orderOf(criterion: CriterionId): number {
  return criterionOrder.get(criterion) ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Contributions are ordered for display by influence, with ruleset order as
 * the deterministic tie-breaker.
 */
export function sortContributions(
  contributions: readonly CriterionContribution[],
): CriterionContribution[] {
  return [...contributions].sort((left, right) => {
    const magnitude = Math.abs(right.scoreImpact) - Math.abs(left.scoreImpact);
    if (magnitude !== 0) return magnitude;
    return orderOf(left.criterion) - orderOf(right.criterion);
  });
}

export function buildExplanationGroups(
  orderedContributions: readonly CriterionContribution[],
  unavailable: readonly UnavailableCriterion[],
): ExplanationGroups {
  const toExplanation = ({
    criterion,
    family,
    messageKey,
    scoreImpact,
  }: CriterionContribution): Explanation => ({
    criterion,
    family,
    messageKey,
    scoreImpact,
  });

  const orderedUnavailable = [...unavailable].sort((left, right) => {
    const weightDifference = right.weight - left.weight;
    if (weightDifference !== 0) return weightDifference;
    return orderOf(left.criterion) - orderOf(right.criterion);
  });

  return {
    supporting: orderedContributions
      .filter(({ scoreImpact }) => scoreImpact > 0)
      .map(toExplanation),
    caution: orderedContributions
      .filter(({ scoreImpact }) => scoreImpact < 0)
      .map(toExplanation),
    informational: orderedContributions
      .filter(({ scoreImpact }) => scoreImpact === 0)
      .map(toExplanation),
    unavailable: orderedUnavailable,
  };
}
