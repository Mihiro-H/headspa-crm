import { describe, it, expect } from "vitest";
import { dbTimeToMinutes, minutesToLabel, addMinutes, monthRange, timeOrNull } from "./time";

describe("dbTimeToMinutes", () => {
  it("converts a DB time (UTC-anchored epoch date) to minutes since midnight", () => {
    expect(dbTimeToMinutes(new Date("1970-01-01T11:00:00Z"))).toBe(660);
  });

  it("handles midnight", () => {
    expect(dbTimeToMinutes(new Date("1970-01-01T00:00:00Z"))).toBe(0);
  });

  it("handles minutes within the hour", () => {
    expect(dbTimeToMinutes(new Date("1970-01-01T19:30:00Z"))).toBe(1170);
  });
});

describe("minutesToLabel", () => {
  it("formats minutes as HH:mm", () => {
    expect(minutesToLabel(90)).toBe("01:30");
  });

  it("pads single-digit hours and minutes", () => {
    expect(minutesToLabel(65)).toBe("01:05");
  });

  it("formats zero as 00:00", () => {
    expect(minutesToLabel(0)).toBe("00:00");
  });
});

describe("addMinutes", () => {
  it("adds a duration to a start time", () => {
    expect(addMinutes(660, 90)).toBe(750);
  });
});

describe("monthRange", () => {
  it("returns the first and last day of the given month in UTC", () => {
    const { start, end } = monthRange("2026-10");
    expect(start).toEqual(new Date("2026-10-01T00:00:00.000Z"));
    expect(end).toEqual(new Date("2026-10-31T00:00:00.000Z"));
  });

  it("handles months with fewer days correctly", () => {
    const { start, end } = monthRange("2026-02");
    expect(start).toEqual(new Date("2026-02-01T00:00:00.000Z"));
    expect(end).toEqual(new Date("2026-02-28T00:00:00.000Z"));
  });
});

describe("timeOrNull", () => {
  it("returns null when minutes is null", () => {
    expect(timeOrNull(null)).toBeNull();
  });

  it("converts minutes to a 1970-01-01-anchored UTC Date", () => {
    expect(timeOrNull(660)).toEqual(new Date("1970-01-01T11:00:00.000Z"));
  });
});
