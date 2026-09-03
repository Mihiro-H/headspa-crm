import { describe, it, expect } from "vitest";
import { hasOverlap, isSlotFree, type ExistingBooking } from "./slot-conflict";

describe("hasOverlap", () => {
  it("detects overlapping ranges", () => {
    expect(hasOverlap(660, 750, { startMinutes: 700, endMinutes: 800 })).toBe(true);
  });

  it("detects identical ranges as overlapping", () => {
    expect(hasOverlap(660, 750, { startMinutes: 660, endMinutes: 750 })).toBe(true);
  });

  it("does not flag back-to-back ranges as overlapping", () => {
    expect(hasOverlap(660, 750, { startMinutes: 750, endMinutes: 840 })).toBe(false);
  });

  it("does not flag fully separate ranges", () => {
    expect(hasOverlap(660, 750, { startMinutes: 800, endMinutes: 900 })).toBe(false);
  });
});

describe("isSlotFree", () => {
  it("returns true when there are no existing bookings", () => {
    expect(isSlotFree(660, 750, [])).toBe(true);
  });

  it("returns false when any existing booking overlaps", () => {
    const existing: ExistingBooking[] = [
      { startMinutes: 500, endMinutes: 600 },
      { startMinutes: 700, endMinutes: 800 },
    ];
    expect(isSlotFree(660, 750, existing)).toBe(false);
  });

  it("returns true when no existing booking overlaps", () => {
    const existing: ExistingBooking[] = [
      { startMinutes: 500, endMinutes: 600 },
      { startMinutes: 800, endMinutes: 900 },
    ];
    expect(isSlotFree(660, 750, existing)).toBe(true);
  });
});
