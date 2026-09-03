import { describe, it, expect } from "vitest";
import { generateAvailableSlots, type GenerateSlotsInput } from "./time-slots";

const baseStore = {
  weekdayOpen: new Date("1970-01-01T11:00:00Z"),
  weekdayClose: new Date("1970-01-01T13:00:00Z"),
  weekendOpen: new Date("1970-01-01T10:00:00Z"),
  weekendClose: new Date("1970-01-01T18:00:00Z"),
  luxuryLastOrderWeekday: new Date("1970-01-01T19:30:00Z"),
  luxuryLastOrderWeekend: new Date("1970-01-01T17:30:00Z"),
};

function baseInput(overrides: Partial<GenerateSlotsInput> = {}): GenerateSlotsInput {
  return {
    store: baseStore,
    date: new Date("2026-09-02T00:00:00Z"),
    holidayDates: [],
    totalDurationMinutes: 60,
    isLuxuryCategory: false,
    slotIntervalMinutes: 30,
    staffShift: undefined,
    existingBookings: [],
    ...overrides,
  };
}

describe("generateAvailableSlots", () => {
  it("generates slots at the configured interval that fit before closing", () => {
    expect(generateAvailableSlots(baseInput())).toEqual([660, 690, 720]);
  });

  it("returns an empty array on a holiday", () => {
    expect(
      generateAvailableSlots(baseInput({ holidayDates: [new Date("2026-09-02T00:00:00Z")] })),
    ).toEqual([]);
  });

  it("excludes any candidate slot that overlaps an existing booking, including ones that start before it", () => {
    // Wider closing time so we get slots both overlapping and clear of the existing booking.
    const result = generateAvailableSlots(
      baseInput({
        store: { ...baseStore, weekdayClose: new Date("1970-01-01T14:30:00Z") },
        existingBookings: [{ startMinutes: 690, endMinutes: 750 }],
      }),
    );
    // Candidates: 660,690,720,750,780,810 (60min duration, close at 870).
    // 660-720, 690-750, 720-780 all overlap [690,750). 750-810 is back-to-back (not an overlap).
    expect(result).toEqual([750, 780, 810]);
  });

  it("excludes slots outside the nominated staff's shift", () => {
    const result = generateAvailableSlots(
      baseInput({
        staffShift: {
          workDate: new Date("2026-09-02T00:00:00Z"),
          startTime: new Date("1970-01-01T11:00:00Z"),
          endTime: new Date("1970-01-01T12:00:00Z"),
          isDayOff: false,
        },
      }),
    );
    expect(result).toEqual([660]);
  });

  it("excludes slots past the luxury cutoff for luxury-category courses", () => {
    const result = generateAvailableSlots(
      baseInput({
        isLuxuryCategory: true,
        store: { ...baseStore, luxuryLastOrderWeekday: new Date("1970-01-01T11:30:00Z") },
      }),
    );
    expect(result).toEqual([660, 690]);
  });
});
