import type { Observation } from "../scoring/evidence-schema";

export function observed<T>(value: T, extractionConfidence: number, source: string): Observation<T> {
  return {
    state: "observed",
    value,
    extractionConfidence: clampConfidence(extractionConfidence),
    source,
  };
}

export function absent<T>(extractionConfidence: number, source: string): Observation<T> {
  return {
    state: "absent",
    extractionConfidence: clampConfidence(extractionConfidence),
    source,
  };
}

export function unavailable<T>(source: string): Observation<T> {
  return { state: "unavailable", extractionConfidence: 0, source };
}

function clampConfidence(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}
