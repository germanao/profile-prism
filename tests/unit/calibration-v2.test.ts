import { describe, expect, it } from "vitest";
import { evaluateProfileEvidence } from "../../src/scoring/evaluate";
import {
  calibrationCases,
  releaseCalibrationGateSatisfied,
} from "../fixtures/calibration-v2";

describe("model-v2 provisional anonymized calibration fixtures", () => {
  it("contains the three anchors and a balanced synthetic control shape", () => {
    expect(calibrationCases.filter(({ category }) => category === "anchor")).toHaveLength(3);
    expect(calibrationCases.filter(({ category }) => category === "medium").length).toBeGreaterThanOrEqual(4);
    expect(calibrationCases.filter(({ category }) => category === "new-private").length).toBeGreaterThanOrEqual(4);
    expect(calibrationCases.filter(({ category }) => category === "negative-control").length).toBeGreaterThanOrEqual(4);
  });

  it("does not mistake synthetic placeholders for a passed public-release gate", () => {
    expect(releaseCalibrationGateSatisfied()).toBe(false);
    expect(calibrationCases.filter(({ provenance }) => provenance === "synthetic-placeholder").length)
      .toBeGreaterThanOrEqual(12);
  });

  it.each(calibrationCases)("keeps $id inside its target range", ({ evidence, expected }) => {
    const result = evaluateProfileEvidence(evidence, {
      fullScanCompleted: true,
      verificationDetailsInspected: true,
    });
    expect(result.score).toBeGreaterThanOrEqual(expected[0]);
    expect(result.score).toBeLessThanOrEqual(expected[1]);
  });

  it("never lets explicit verification override a material conflict", () => {
    const controls = calibrationCases.filter(({ id }) =>
      id === "negative-verified-but-contradictory" ||
      id === "negative-potentially-compromised-old-account",
    );
    for (const { evidence } of controls) {
      expect(evaluateProfileEvidence(evidence, {
        fullScanCompleted: true,
        verificationDetailsInspected: true,
      }).score).toBeLessThanOrEqual(64);
    }
  });

  it("contains no URL- or supplied-profile-specific rule key", () => {
    const serialized = JSON.stringify(calibrationCases);
    expect(serialized).not.toMatch(/linkedin\.com|germano|henrique|vanessa|profile_id/iu);
  });
});
