import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseProfileRoute,
  RouteCoordinator,
  type RouteEvent
} from "../../src/content/route-coordinator";

describe("profile route parsing", () => {
  it("accepts only the supported HTTPS LinkedIn profile route", () => {
    expect(parseProfileRoute("https://www.linkedin.com/in/ada-lovelace/")?.key).toBe(
      "https://www.linkedin.com/in/ada-lovelace/"
    );
    expect(parseProfileRoute("https://www.linkedin.com/in/ada-lovelace?x=1")?.key).toBe(
      "https://www.linkedin.com/in/ada-lovelace/"
    );
    expect(parseProfileRoute("http://www.linkedin.com/in/ada/")).toBeNull();
    expect(parseProfileRoute("https://linkedin.com/in/ada/")).toBeNull();
    expect(parseProfileRoute("https://www.linkedin.com/company/example/")).toBeNull();
    expect(parseProfileRoute("https://www.linkedin.com/in/ada/details/experience/")).toBeNull();
  });
});

describe("RouteCoordinator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "<main></main>";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces visible mutations and ignores extension-owned UI", async () => {
    const fakeLocation = {
      href: "https://www.linkedin.com/in/ada-lovelace/"
    } as Location;
    const events: RouteEvent[] = [];
    const coordinator = new RouteCoordinator((event) => events.push(event), {
      document,
      location: fakeLocation,
      debounceMs: 25
    });
    coordinator.start();
    expect(events.map((event) => event.kind)).toEqual(["route-changed"]);

    const section = document.createElement("section");
    section.textContent = "Visible experience";
    document.querySelector("main")!.append(section);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(25);
    expect(events.map((event) => event.kind)).toEqual([
      "route-changed",
      "visible-dom-changed"
    ]);

    const owned = document.createElement("span");
    owned.setAttribute("data-profile-authenticity-host", "test");
    document.body.append(owned);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(25);
    expect(events).toHaveLength(2);

    coordinator.stop();
  });

  it("requests a repair when LinkedIn removes the mounted name badge", async () => {
    const fakeLocation = {
      href: "https://www.linkedin.com/in/ada-lovelace/"
    } as Location;
    const events: RouteEvent[] = [];
    const coordinator = new RouteCoordinator((event) => events.push(event), {
      document,
      location: fakeLocation,
      debounceMs: 25
    });
    const heading = document.createElement("h1");
    heading.textContent = "Ada Lovelace";
    document.querySelector("main")!.append(heading);
    const badge = document.createElement("span");
    badge.setAttribute(
      "data-profile-authenticity-host",
      "profile-evidence-badge"
    );
    heading.append(badge);

    coordinator.start();
    badge.remove();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(25);

    expect(events.map((event) => event.kind)).toEqual([
      "route-changed",
      "badge-mount-invalidated"
    ]);
    coordinator.stop();
  });

  it("does not starve a refresh while LinkedIn keeps rendering", async () => {
    const fakeLocation = {
      href: "https://www.linkedin.com/in/ada-lovelace/"
    } as Location;
    const events: RouteEvent[] = [];
    const coordinator = new RouteCoordinator((event) => events.push(event), {
      document,
      location: fakeLocation,
      debounceMs: 25,
      maxWaitMs: 30
    });
    coordinator.start();

    document.querySelector("main")!.append(document.createElement("section"));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(20);
    document.querySelector("main")!.append(document.createElement("section"));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10);

    expect(events.map((event) => event.kind)).toEqual([
      "route-changed",
      "visible-dom-changed"
    ]);
    coordinator.stop();
  });

  it("coalesces a sustained profile mutation storm into one bounded refresh", async () => {
    const fakeLocation = {
      href: "https://www.linkedin.com/in/ada-lovelace/"
    } as Location;
    const events: RouteEvent[] = [];
    const coordinator = new RouteCoordinator((event) => events.push(event), {
      document,
      location: fakeLocation,
      debounceMs: 50,
      maxWaitMs: 100
    });
    coordinator.start();

    for (let index = 0; index < 8; index += 1) {
      document.querySelector("main")!.append(document.createElement("section"));
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(10);
    }
    expect(events.map((event) => event.kind)).toEqual(["route-changed"]);

    await vi.advanceTimersByTimeAsync(20);
    expect(events.map((event) => event.kind)).toEqual([
      "route-changed",
      "visible-dom-changed"
    ]);
    await vi.advanceTimersByTimeAsync(200);
    expect(events).toHaveLength(2);
    coordinator.stop();
  });

  it("refreshes for evidence-bearing attribute changes", async () => {
    const fakeLocation = {
      href: "https://www.linkedin.com/in/ada-lovelace/"
    } as Location;
    const events: RouteEvent[] = [];
    const coordinator = new RouteCoordinator((event) => events.push(event), {
      document,
      location: fakeLocation,
      debounceMs: 10
    });
    coordinator.start();

    document.querySelector("main")!.setAttribute("aria-label", "Verified profile");
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10);

    expect(events.map((event) => event.kind)).toEqual([
      "route-changed",
      "visible-dom-changed"
    ]);
    coordinator.stop();
  });

  it("ignores unrelated navigation and messaging mutations", async () => {
    const fakeLocation = {
      href: "https://www.linkedin.com/in/ada-lovelace/"
    } as Location;
    const events: RouteEvent[] = [];
    const coordinator = new RouteCoordinator((event) => events.push(event), {
      document,
      location: fakeLocation,
      debounceMs: 10
    });
    coordinator.start();

    const navigation = document.createElement("nav");
    navigation.textContent = "3 new notifications";
    document.querySelector("main")!.append(navigation);
    navigation.setAttribute("aria-label", "Global navigation");
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(20);

    expect(events.map((event) => event.kind)).toEqual(["route-changed"]);
    coordinator.stop();
  });

  it("does not observe profile evidence while the current LinkedIn route is unsupported", async () => {
    const fakeLocation = {
      href: "https://www.linkedin.com/feed/"
    } as Location;
    const events: RouteEvent[] = [];
    const coordinator = new RouteCoordinator((event) => events.push(event), {
      document,
      location: fakeLocation,
      debounceMs: 10,
      maxWaitMs: 30
    });
    coordinator.start();

    document.querySelector("main")!.append(document.createElement("section"));
    document.querySelector("main")!.setAttribute("aria-label", "Changing feed");
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100);

    expect(events.map((event) => event.kind)).toEqual(["route-changed"]);
    coordinator.stop();
  });

  it("detects feed-to-profile SPA navigation without a page refresh", async () => {
    const fakeLocation = {
      href: "https://www.linkedin.com/feed/"
    } as Location;
    const events: RouteEvent[] = [];
    const coordinator = new RouteCoordinator((event) => events.push(event), {
      document,
      location: fakeLocation,
      debounceMs: 10
    });
    coordinator.start();

    fakeLocation.href = "https://www.linkedin.com/in/example-person/";
    document.querySelector("main")!.append(document.createElement("section"));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10);

    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      kind: "route-changed",
      route: { key: "https://www.linkedin.com/in/example-person/" }
    });
    coordinator.stop();
  });

  it("tears the prior route down when SPA navigation changes the URL", async () => {
    const fakeLocation = {
      href: "https://www.linkedin.com/in/first-profile/"
    } as Location;
    const events: RouteEvent[] = [];
    const coordinator = new RouteCoordinator((event) => events.push(event), {
      document,
      location: fakeLocation,
      debounceMs: 10
    });
    coordinator.start();
    fakeLocation.href = "https://www.linkedin.com/in/second-profile/";
    document.body.append(document.createElement("main"));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10);

    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      kind: "route-changed",
      route: { key: "https://www.linkedin.com/in/second-profile/" }
    });
    coordinator.stop();
  });
});
