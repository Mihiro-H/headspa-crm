import { describe, it, expect } from "vitest";
import {
  calculateCancellationDeadline,
  isPastCancellationDeadline,
} from "./cancellation-deadline";

describe("calculateCancellationDeadline", () => {
  it("returns 23:59:59 the day before the reservation date", () => {
    const deadline = calculateCancellationDeadline(new Date("2026-09-10T00:00:00Z"));
    expect(deadline.toISOString()).toBe("2026-09-09T23:59:59.000Z");
  });

  it("handles month boundaries correctly", () => {
    const deadline = calculateCancellationDeadline(new Date("2026-10-01T00:00:00Z"));
    expect(deadline.toISOString()).toBe("2026-09-30T23:59:59.000Z");
  });
});

describe("isPastCancellationDeadline", () => {
  it("returns false before the deadline", () => {
    const deadline = new Date("2026-09-09T23:59:59.000Z");
    expect(isPastCancellationDeadline(deadline, new Date("2026-09-09T12:00:00Z"))).toBe(false);
  });

  it("returns true after the deadline", () => {
    const deadline = new Date("2026-09-09T23:59:59.000Z");
    expect(isPastCancellationDeadline(deadline, new Date("2026-09-10T00:00:00Z"))).toBe(true);
  });
});
