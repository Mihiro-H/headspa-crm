import { describe, it, expect } from "vitest";
import { getStoreOpenHours, isStoreHoliday, type StoreHoursInput } from "./store-hours";

const store: StoreHoursInput = {
  weekdayOpen: new Date("1970-01-01T11:00:00Z"),
  weekdayClose: new Date("1970-01-01T20:00:00Z"),
  weekendOpen: new Date("1970-01-01T10:00:00Z"),
  weekendClose: new Date("1970-01-01T18:00:00Z"),
};

describe("getStoreOpenHours", () => {
  it("returns weekday hours for a Wednesday", () => {
    const result = getStoreOpenHours(store, new Date("2026-09-02T00:00:00Z"));
    expect(result).toEqual({ openMinutes: 660, closeMinutes: 1200 });
  });

  it("returns weekend hours for a Saturday", () => {
    const result = getStoreOpenHours(store, new Date("2026-09-05T00:00:00Z"));
    expect(result).toEqual({ openMinutes: 600, closeMinutes: 1080 });
  });

  it("returns weekend hours for a Sunday", () => {
    const result = getStoreOpenHours(store, new Date("2026-09-06T00:00:00Z"));
    expect(result).toEqual({ openMinutes: 600, closeMinutes: 1080 });
  });
});

describe("isStoreHoliday", () => {
  it("returns true when the date matches a holiday", () => {
    const holidays = [new Date("2026-09-10T00:00:00Z")];
    expect(isStoreHoliday(new Date("2026-09-10T00:00:00Z"), holidays)).toBe(true);
  });

  it("returns false when the date does not match any holiday", () => {
    const holidays = [new Date("2026-09-10T00:00:00Z")];
    expect(isStoreHoliday(new Date("2026-09-11T00:00:00Z"), holidays)).toBe(false);
  });

  it("returns false for an empty holiday list", () => {
    expect(isStoreHoliday(new Date("2026-09-10T00:00:00Z"), [])).toBe(false);
  });
});
