import { describe, it, expect } from "vitest";
import { formatDateTimeJst } from "./format-datetime";

describe("formatDateTimeJst", () => {
  it("converts a UTC ISO string to JST (UTC+9) and formats as YYYY-MM-DD HH:MM", () => {
    expect(formatDateTimeJst("2026-09-14T00:28:05.201Z")).toBe("2026-09-14 09:28");
  });

  it("rolls over to the next day when adding 9 hours crosses midnight", () => {
    expect(formatDateTimeJst("2026-09-13T16:04:54.825Z")).toBe("2026-09-14 01:04");
  });

  it("rolls over to the next month/year when the day rolls over at year end", () => {
    expect(formatDateTimeJst("2026-12-31T15:30:00.000Z")).toBe("2027-01-01 00:30");
  });

  it("drops seconds and milliseconds, and zero-pads month/day/hour/minute", () => {
    expect(formatDateTimeJst("2026-01-02T00:05:09.999Z")).toBe("2026-01-02 09:05");
  });
});
