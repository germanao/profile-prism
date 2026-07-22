import { describe, expect, it } from "vitest";
import {
  RouteEvidenceAccumulator,
  mergeEvidenceSnapshots,
} from "../../src/content/evidence-accumulator";
import {
  observedObservation,
  unavailableObservation,
  type Observation,
} from "../../src/scoring/evidence-schema";

interface TestEvidence {
  identity: Observation<"verified">;
  history: Observation<"rich">;
}

describe("route evidence accumulation", () => {
  it("does not let unavailable lazy-DOM observations erase known evidence", () => {
    const known = observedObservation<"verified">("verified", "dialog", 0.95);
    const merged = mergeEvidenceSnapshots<TestEvidence>(
      { identity: known },
      {
        identity: unavailableObservation("dialog-closed"),
        history: observedObservation("rich", "experience", 0.9),
      },
    );

    expect(merged.identity).toBe(known);
    expect(merged.history).toMatchObject({ state: "observed", value: "rich" });
  });

  it("clears evidence when the route changes", () => {
    const accumulator = new RouteEvidenceAccumulator<TestEvidence>();
    accumulator.merge("route-a", {
      identity: observedObservation("verified", "dialog"),
    });
    expect(accumulator.snapshot("route-a")).toHaveProperty("identity");

    accumulator.beginRoute("route-b");
    expect(accumulator.snapshot("route-a")).toEqual({});
    expect(accumulator.snapshot("route-b")).toEqual({});
  });
});
