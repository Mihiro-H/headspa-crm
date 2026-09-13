import { describe, it, expect } from "vitest";
import { isShiftRequestComplete } from "./shift-request-completion";

describe("isShiftRequestComplete", () => {
  it("returns false when there is no submitted request (未提出)", () => {
    expect(isShiftRequestComplete(undefined)).toBe(false);
  });

  it("returns true for requestType 'full'", () => {
    expect(
      isShiftRequestComplete({
        requestType: "full",
        preferredStartMinutes: null,
        preferredEndMinutes: null,
      }),
    ).toBe(true);
  });

  it("returns true for requestType 'day_off'", () => {
    expect(
      isShiftRequestComplete({
        requestType: "day_off",
        preferredStartMinutes: null,
        preferredEndMinutes: null,
      }),
    ).toBe(true);
  });

  it("returns false for requestType 'reduced' when both times are missing (不備)", () => {
    expect(
      isShiftRequestComplete({
        requestType: "reduced",
        preferredStartMinutes: null,
        preferredEndMinutes: null,
      }),
    ).toBe(false);
  });

  it("returns true for requestType 'reduced' when only the start time is given", () => {
    expect(
      isShiftRequestComplete({
        requestType: "reduced",
        preferredStartMinutes: 660,
        preferredEndMinutes: null,
      }),
    ).toBe(true);
  });

  it("returns true for requestType 'reduced' when only the end time is given", () => {
    expect(
      isShiftRequestComplete({
        requestType: "reduced",
        preferredStartMinutes: null,
        preferredEndMinutes: 1000,
      }),
    ).toBe(true);
  });

  it("returns true for requestType 'reduced' when both times are given", () => {
    expect(
      isShiftRequestComplete({
        requestType: "reduced",
        preferredStartMinutes: 660,
        preferredEndMinutes: 1000,
      }),
    ).toBe(true);
  });
});
