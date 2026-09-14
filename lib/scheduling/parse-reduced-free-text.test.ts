import { describe, it, expect } from "vitest";
import { parseReducedFreeText } from "./parse-reduced-free-text";

describe("parseReducedFreeText", () => {
  it("parses a simple half-width line", () => {
    const result = parseReducedFreeText("10/5 11:00-15:00", "2026-10");
    expect(result).toEqual({
      lines: [
        {
          workDate: "2026-10-05",
          start: { type: "minutes", value: 660 },
          end: { type: "minutes", value: 900 },
        },
      ],
      unparsedLines: [],
    });
  });

  it("parses 開店/閉店 keywords as store_open/store_close", () => {
    const result = parseReducedFreeText("10/12 開店〜14:00", "2026-10");
    expect(result).toEqual({
      lines: [
        {
          workDate: "2026-10-12",
          start: { type: "store_open" },
          end: { type: "minutes", value: 840 },
        },
      ],
      unparsedLines: [],
    });

    const result2 = parseReducedFreeText("10/12 11:00〜閉店", "2026-10");
    expect(result2).toEqual({
      lines: [
        {
          workDate: "2026-10-12",
          start: { type: "minutes", value: 660 },
          end: { type: "store_close" },
        },
      ],
      unparsedLines: [],
    });
  });

  it("normalizes full-width digits, slash, and colon", () => {
    const result = parseReducedFreeText("１０/５ １１:００-１５:００", "2026-10");
    expect(result).toEqual({
      lines: [
        {
          workDate: "2026-10-05",
          start: { type: "minutes", value: 660 },
          end: { type: "minutes", value: 900 },
        },
      ],
      unparsedLines: [],
    });
  });

  it("accepts -, 〜, and ~ as the separator between start and end", () => {
    expect(parseReducedFreeText("10/5 11:00~15:00", "2026-10").lines).toHaveLength(1);
    expect(parseReducedFreeText("10/5 11:00〜15:00", "2026-10").lines).toHaveLength(1);
    expect(parseReducedFreeText("10/5 11:00-15:00", "2026-10").lines).toHaveLength(1);
  });

  it("skips blank lines without adding them to unparsedLines", () => {
    const result = parseReducedFreeText("10/5 11:00-15:00\n\n\n10/12 開店〜14:00", "2026-10");
    expect(result.lines).toHaveLength(2);
    expect(result.unparsedLines).toEqual([]);
  });

  it("collects lines that do not match the expected format as unparsedLines", () => {
    const result = parseReducedFreeText("よろしくお願いします", "2026-10");
    expect(result).toEqual({ lines: [], unparsedLines: ["よろしくお願いします"] });
  });

  it("collects a line with an out-of-range month or day as unparsedLines", () => {
    const result = parseReducedFreeText("13/40 11:00-15:00", "2026-10");
    expect(result).toEqual({ lines: [], unparsedLines: ["13/40 11:00-15:00"] });
  });

  it("collects a line with an unparseable time token as unparsedLines", () => {
    const result = parseReducedFreeText("10/5 午前-午後", "2026-10");
    expect(result).toEqual({ lines: [], unparsedLines: ["10/5 午前-午後"] });
  });

  it("processes multiple lines independently, mixing valid and invalid ones", () => {
    const result = parseReducedFreeText(
      "10/5 11:00-15:00\nよろしくお願いします\n10/12 開店〜14:00",
      "2026-10",
    );
    expect(result.lines).toHaveLength(2);
    expect(result.unparsedLines).toEqual(["よろしくお願いします"]);
  });

  it("collects a calendar-invalid date (e.g. February 30th) as unparsedLines instead of silently rolling over", () => {
    const result = parseReducedFreeText("2/30 11:00-15:00", "2026-10");
    expect(result).toEqual({ lines: [], unparsedLines: ["2/30 11:00-15:00"] });
  });

  it("accepts the full-width tilde and full-width hyphen as separators", () => {
    const result = parseReducedFreeText("10/5 11:00～15:00\n10/6 11:00－15:00", "2026-10");
    expect(result.lines).toEqual([
      {
        workDate: "2026-10-05",
        start: { type: "minutes", value: 660 },
        end: { type: "minutes", value: 900 },
      },
      {
        workDate: "2026-10-06",
        start: { type: "minutes", value: 660 },
        end: { type: "minutes", value: 900 },
      },
    ]);
    expect(result.unparsedLines).toEqual([]);
  });
});
