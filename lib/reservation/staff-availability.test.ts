import { describe, it, expect } from "vitest";
import { isStaffAvailableForSlot, type StaffShiftInput } from "./staff-availability";

describe("isStaffAvailableForSlot", () => {
  it("returns false when no shift is provided", () => {
    expect(isStaffAvailableForSlot(undefined, 660, 750)).toBe(false);
  });

  it("returns false when the staff is off that day", () => {
    const shift: StaffShiftInput = {
      workDate: new Date("2026-09-02T00:00:00Z"),
      startTime: null,
      endTime: null,
      isDayOff: true,
    };
    expect(isStaffAvailableForSlot(shift, 660, 750)).toBe(false);
  });

  it("returns true when the slot is fully within the shift", () => {
    const shift: StaffShiftInput = {
      workDate: new Date("2026-09-02T00:00:00Z"),
      startTime: new Date("1970-01-01T10:00:00Z"),
      endTime: new Date("1970-01-01T19:00:00Z"),
      isDayOff: false,
    };
    expect(isStaffAvailableForSlot(shift, 660, 750)).toBe(true);
  });

  it("returns false when the slot starts before the shift begins", () => {
    const shift: StaffShiftInput = {
      workDate: new Date("2026-09-02T00:00:00Z"),
      startTime: new Date("1970-01-01T12:00:00Z"),
      endTime: new Date("1970-01-01T19:00:00Z"),
      isDayOff: false,
    };
    expect(isStaffAvailableForSlot(shift, 660, 750)).toBe(false);
  });

  it("returns false when the slot ends after the shift ends", () => {
    const shift: StaffShiftInput = {
      workDate: new Date("2026-09-02T00:00:00Z"),
      startTime: new Date("1970-01-01T10:00:00Z"),
      endTime: new Date("1970-01-01T12:00:00Z"),
      isDayOff: false,
    };
    expect(isStaffAvailableForSlot(shift, 660, 750)).toBe(false);
  });
});
