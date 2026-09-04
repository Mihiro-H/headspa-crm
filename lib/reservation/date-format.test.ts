import { describe, it, expect } from "vitest";
import { formatJapaneseDate } from "./date-format";

describe("formatJapaneseDate", () => {
  it("formats a date string with the Japanese weekday", () => {
    expect(formatJapaneseDate("2026-09-13")).toBe("2026年9月13日（日）");
  });

  it("formats a different date/weekday correctly", () => {
    expect(formatJapaneseDate("2026-09-12")).toBe("2026年9月12日（土）");
  });

  it("does not zero-pad the month or day", () => {
    expect(formatJapaneseDate("2026-01-05")).toBe("2026年1月5日（月）");
  });
});
