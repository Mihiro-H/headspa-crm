import { describe, it, expect } from "vitest";
import { isWithinLuxuryCutoff, type LuxuryCutoffInput } from "./luxury-cutoff";

const store: LuxuryCutoffInput = {
  luxuryLastOrderWeekday: new Date("1970-01-01T19:30:00Z"),
  luxuryLastOrderWeekend: new Date("1970-01-01T17:30:00Z"),
};

describe("isWithinLuxuryCutoff", () => {
  it("allows a weekday slot at exactly the cutoff time", () => {
    expect(isWithinLuxuryCutoff(store, new Date("2026-09-02T00:00:00Z"), 1170)).toBe(true);
  });

  it("rejects a weekday slot after the cutoff time", () => {
    expect(isWithinLuxuryCutoff(store, new Date("2026-09-02T00:00:00Z"), 1171)).toBe(false);
  });

  it("uses the weekend cutoff on Saturday", () => {
    expect(isWithinLuxuryCutoff(store, new Date("2026-09-05T00:00:00Z"), 1050)).toBe(true);
    expect(isWithinLuxuryCutoff(store, new Date("2026-09-05T00:00:00Z"), 1051)).toBe(false);
  });
});
