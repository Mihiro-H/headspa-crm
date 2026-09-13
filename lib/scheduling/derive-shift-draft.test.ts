import { describe, it, expect } from "vitest";
import { deriveDraftShift } from "./derive-shift-draft";

const STORE_HOURS = { openMinutes: 660, closeMinutes: 1110 }; // 11:00-18:30

describe("deriveDraftShift", () => {
  it("returns day off when there is no request", () => {
    const result = deriveDraftShift(null, STORE_HOURS);
    expect(result).toEqual({ isDayOff: true, startMinutes: null, endMinutes: null });
  });

  it("returns day off when the request asks for a day off", () => {
    const result = deriveDraftShift(
      { isDayOffRequested: true, preferredStartMinutes: null, preferredEndMinutes: null },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: true, startMinutes: null, endMinutes: null });
  });

  it("returns day off when times are missing despite not being a day-off request", () => {
    const result = deriveDraftShift(
      { isDayOffRequested: false, preferredStartMinutes: null, preferredEndMinutes: 1000 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: true, startMinutes: null, endMinutes: null });
  });

  it("uses the requested time range as-is when it fits within store hours", () => {
    const result = deriveDraftShift(
      { isDayOffRequested: false, preferredStartMinutes: 700, preferredEndMinutes: 1000 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 700, endMinutes: 1000 });
  });

  it("clamps a requested start time earlier than store open", () => {
    const result = deriveDraftShift(
      { isDayOffRequested: false, preferredStartMinutes: 500, preferredEndMinutes: 1000 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 660, endMinutes: 1000 });
  });

  it("clamps a requested end time later than store close", () => {
    const result = deriveDraftShift(
      { isDayOffRequested: false, preferredStartMinutes: 700, preferredEndMinutes: 1200 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: false, startMinutes: 700, endMinutes: 1110 });
  });

  it("falls back to a day off when clamping collapses the range to zero or negative width", () => {
    // 希望が丸ごと営業時間外（開店前に終わる希望）→ クランプ後 start(660) >= end(660)
    const result = deriveDraftShift(
      { isDayOffRequested: false, preferredStartMinutes: 500, preferredEndMinutes: 600 },
      STORE_HOURS,
    );
    expect(result).toEqual({ isDayOff: true, startMinutes: null, endMinutes: null });
  });
});
