import { describe, it, expect } from "vitest";
import { isWithinBookingWindow, MAX_BOOKING_MONTHS_AHEAD } from "./booking-window";

describe("isWithinBookingWindow", () => {
  it("allows a date within the booking window", () => {
    const today = new Date("2026-09-05T00:00:00.000Z");
    const date = new Date("2026-11-05T00:00:00.000Z");
    expect(isWithinBookingWindow(date, today)).toBe(true);
  });

  it(`allows a date exactly ${MAX_BOOKING_MONTHS_AHEAD} months ahead`, () => {
    const today = new Date("2026-09-05T00:00:00.000Z");
    const date = new Date("2026-12-05T00:00:00.000Z");
    expect(isWithinBookingWindow(date, today)).toBe(true);
  });

  it(`rejects a date beyond ${MAX_BOOKING_MONTHS_AHEAD} months ahead`, () => {
    const today = new Date("2026-09-05T00:00:00.000Z");
    const date = new Date("2026-12-06T00:00:00.000Z");
    expect(isWithinBookingWindow(date, today)).toBe(false);
  });

  it("allows today itself", () => {
    const today = new Date("2026-09-05T00:00:00.000Z");
    expect(isWithinBookingWindow(today, today)).toBe(true);
  });
});
