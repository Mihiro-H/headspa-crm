import { describe, it, expect } from "vitest";
import { checkGenderRestriction } from "./gender-restriction";

describe("checkGenderRestriction", () => {
  it("allows anyone when there is no restriction", () => {
    expect(checkGenderRestriction("none", "female")).toEqual({ allowed: true, warning: false });
    expect(checkGenderRestriction("none", "male")).toEqual({ allowed: true, warning: false });
    expect(checkGenderRestriction("none", "other")).toEqual({ allowed: true, warning: false });
  });

  it("blocks the excluded gender (e.g. フォーメン excludes female)", () => {
    expect(checkGenderRestriction("female", "female")).toEqual({
      allowed: false,
      warning: false,
    });
  });

  it("allows the non-excluded gender", () => {
    expect(checkGenderRestriction("female", "male")).toEqual({ allowed: true, warning: false });
  });

  it("allows 'other' gender members with a warning instead of blocking", () => {
    expect(checkGenderRestriction("female", "other")).toEqual({ allowed: true, warning: true });
    expect(checkGenderRestriction("male", "other")).toEqual({ allowed: true, warning: true });
  });
});
