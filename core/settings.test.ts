import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, LIMITS, parseSettings, serializeSettings } from "./settings";

describe("lab settings in the address bar", () => {
  it("uses the defaults for an empty address", () => {
    expect(parseSettings(new URLSearchParams())).toEqual(DEFAULT_SETTINGS);
    expect(serializeSettings(DEFAULT_SETTINGS).toString()).toBe("");
  });

  it("round-trips any valid settings", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 24 }).map((n) => n * 5),
        fc.integer({ min: LIMITS.threshold.min, max: LIMITS.threshold.max }),
        fc.constantFrom("off" as const, "high" as const, "high_medium" as const),
        fc.constantFrom("score" as const, "arrival" as const),
        fc.integer({ min: 0, max: 20 }).map((n) => n / 10),
        (capacity, threshold, aiPolicy, queueOrder, fit) => {
          const settings = {
            ...DEFAULT_SETTINGS,
            capacity,
            threshold,
            aiPolicy,
            queueOrder,
            weights: { ...DEFAULT_SETTINGS.weights, fit },
          };
          expect(parseSettings(serializeSettings(settings))).toEqual(settings);
        },
      ),
    );
  });

  it("clamps and snaps values that were typed by hand", () => {
    const settings = parseSettings(
      new URLSearchParams("calls=999&min=-4&ai=always&order=x&wfit=1.234&week=nope"),
    );
    expect(settings.capacity).toBe(LIMITS.capacity.max);
    expect(settings.threshold).toBe(LIMITS.threshold.min);
    expect(settings.aiPolicy).toBe(DEFAULT_SETTINGS.aiPolicy);
    expect(settings.queueOrder).toBe(DEFAULT_SETTINGS.queueOrder);
    expect(settings.weights.fit).toBe(1.2);
    expect(settings.week).toBe(DEFAULT_SETTINGS.week);
    expect(parseSettings(new URLSearchParams("calls=47")).capacity).toBe(45);
    expect(parseSettings(new URLSearchParams("calls=abc")).capacity).toBe(
      DEFAULT_SETTINGS.capacity,
    );
  });
});
