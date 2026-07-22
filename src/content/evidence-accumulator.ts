interface ObservationLike {
  state: "observed" | "absent" | "unavailable";
}

function isObservationLike(value: unknown): value is ObservationLike {
  if (!value || typeof value !== "object") return false;
  const state = (value as { state?: unknown }).state;
  return state === "observed" || state === "absent" || state === "unavailable";
}

/**
 * Merges progressively rendered evidence without allowing a later
 * `unavailable` observation to erase something already inspected. Known
 * incoming observations otherwise supersede older observations because the
 * later DOM is normally the more complete view.
 */
export function mergeEvidenceSnapshots<Evidence extends object>(
  current: Readonly<Partial<Evidence>>,
  incoming: Readonly<Partial<Evidence>>,
): Partial<Evidence> {
  const merged: Partial<Evidence> = { ...current };
  for (const key of Object.keys(incoming) as Array<keyof Evidence>) {
    const next = incoming[key];
    if (next === undefined) continue;
    const previous = current[key];
    if (
      isObservationLike(next) &&
      next.state === "unavailable" &&
      isObservationLike(previous) &&
      previous.state !== "unavailable"
    ) {
      continue;
    }
    Object.assign(merged, { [key]: next });
  }
  return merged;
}

/** Route-scoped, memory-only storage for evidence seen during one scan. */
export class RouteEvidenceAccumulator<Evidence extends object> {
  private routeKey: string | null = null;
  private accumulated: Partial<Evidence> = {};

  beginRoute(routeKey: string): void {
    if (this.routeKey === routeKey) return;
    this.routeKey = routeKey;
    this.accumulated = {};
  }

  merge(routeKey: string, evidence: Readonly<Partial<Evidence>>): Readonly<Partial<Evidence>> {
    if (this.routeKey !== routeKey) {
      this.beginRoute(routeKey);
    }
    this.accumulated = mergeEvidenceSnapshots(this.accumulated, evidence);
    return this.snapshot();
  }

  snapshot(routeKey = this.routeKey): Readonly<Partial<Evidence>> {
    if (!routeKey || routeKey !== this.routeKey) return {} as Partial<Evidence>;
    return { ...this.accumulated };
  }

  clear(): void {
    this.routeKey = null;
    this.accumulated = {};
  }
}
