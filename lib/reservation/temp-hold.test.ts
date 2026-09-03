import { describe, it, expect } from "vitest";
import {
  TEMP_HOLD_DURATION_MINUTES,
  calculateTempHoldExpiry,
  isTempHoldExpired,
} from "./temp-hold";

describe("calculateTempHoldExpiry", () => {
  it("adds 10 minutes to the current time", () => {
    const now = new Date("2026-09-02T10:00:00.000Z");
    const expiry = calculateTempHoldExpiry(now);
    expect(expiry.toISOString()).toBe("2026-09-02T10:10:00.000Z");
  });

  it("uses the exported duration constant", () => {
    expect(TEMP_HOLD_DURATION_MINUTES).toBe(10);
  });
});

describe("isTempHoldExpired", () => {
  it("returns false before expiry", () => {
    const expiresAt = new Date("2026-09-02T10:10:00.000Z");
    expect(isTempHoldExpired(expiresAt, new Date("2026-09-02T10:05:00.000Z"))).toBe(false);
  });

  it("returns true after expiry", () => {
    const expiresAt = new Date("2026-09-02T10:10:00.000Z");
    expect(isTempHoldExpired(expiresAt, new Date("2026-09-02T10:10:01.000Z"))).toBe(true);
  });
});
