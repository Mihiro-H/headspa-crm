import { describe, it, expect } from "vitest";
import { deriveDraftShift } from "./derive-shift-draft";

const STORE_HOURS = { openMinutes: 660, closeMinutes: 1110 }; // 11:00-18:30

describe("deriveDraftShift", () => {
  it("returns full attendance when there is no request (未提出)", () => {
    const result = deriveDraftShift(null, STORE_HOURS);
    expect(result).toEqual({ isDayOff: false, startMinutes: 660, endMinutes: 1110 });
  });

  it("returns full attendance when requestType is 'full', ignoring any preferred times", () => {
    const result = deriveDraftShift(
      { requestType: "full", preferredStartMinutes: 700, preferredEndMinutes: 800 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 660, endMinutes: 1110 });
  });

  it("returns day off when requestType is 'day_off'", () => {
    const result = deriveDraftShift(
      { requestType: "day_off", preferredStartMinutes: null, preferredEndMinutes: null },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: true, startMinutes: null, endMinutes: null });
  });

  it("returns day off when requestType is 'reduced' but both times are missing (不備)", () => {
    const result = deriveDraftShift(
      { requestType: "reduced", preferredStartMinutes: null, preferredEndMinutes: null },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: true, startMinutes: null, endMinutes: null });
  });

  it("fills in the store's opening time when only the end time is given", () => {
    const result = deriveDraftShift(
      { requestType: "reduced", preferredStartMinutes: null, preferredEndMinutes: 1000 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 660, endMinutes: 1000 });
  });

  it("fills in the store's closing time when only the start time is given", () => {
    const result = deriveDraftShift(
      { requestType: "reduced", preferredStartMinutes: 700, preferredEndMinutes: null },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 700, endMinutes: 1110 });
  });

  it("uses the requested time range as-is when both are given and fit within store hours", () => {
    const result = deriveDraftShift(
      { requestType: "reduced", preferredStartMinutes: 700, preferredEndMinutes: 1000 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 700, endMinutes: 1000 });
  });

  it("clamps a requested start time earlier than store open", () => {
    const result = deriveDraftShift(
      { requestType: "reduced", preferredStartMinutes: 500, preferredEndMinutes: 1000 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 660, endMinutes: 1000 });
  });

  it("clamps a requested end time later than store close", () => {
    const result = deriveDraftShift(
      { requestType: "reduced", preferredStartMinutes: 700, preferredEndMinutes: 1200 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 700, endMinutes: 1110 });
  });

  it("falls back to a day off when clamping collapses the range to zero or negative width", () => {
    const result = deriveDraftShift(
      { requestType: "reduced", preferredStartMinutes: 500, preferredEndMinutes: 600 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: true, startMinutes: null, endMinutes: null });
  });
});
