import { describe, it, expect } from "vitest";
import { parseLineResumeState, type WizardState } from "./wizard-state";

const completeState: WizardState = {
  step: 7,
  storeId: 1,
  categoryId: 2,
  courseId: 11,
  optionIds: [4],
  staffId: null,
  reservationDate: "2026-09-20",
  startTimeLabel: "10:00",
  reservationId: 123,
  errorMessage: null,
};

describe("parseLineResumeState", () => {
  it("returns null when there is nothing saved", () => {
    expect(parseLineResumeState(null)).toBeNull();
  });

  it("returns null when the saved value is not valid JSON", () => {
    expect(parseLineResumeState("{not json")).toBeNull();
  });

  it("forces step to 8 (confirmation) on an otherwise-complete saved state", () => {
    const result = parseLineResumeState(JSON.stringify(completeState));
    expect(result).toEqual({ ...completeState, step: 8 });
  });

  it("returns null when the saved state has no temp-hold reservation id", () => {
    const incomplete = { ...completeState, reservationId: null };
    expect(parseLineResumeState(JSON.stringify(incomplete))).toBeNull();
  });

  it("returns null when the saved state is missing the selected date", () => {
    const incomplete = { ...completeState, reservationDate: null };
    expect(parseLineResumeState(JSON.stringify(incomplete))).toBeNull();
  });

  it("returns null when the saved state is missing the selected start time", () => {
    const incomplete = { ...completeState, startTimeLabel: null };
    expect(parseLineResumeState(JSON.stringify(incomplete))).toBeNull();
  });
});
