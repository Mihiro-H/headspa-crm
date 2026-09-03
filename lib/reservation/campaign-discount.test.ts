import { describe, it, expect } from "vitest";
import { calculateDiscountAmount, applyCampaignDiscount } from "./campaign-discount";

describe("calculateDiscountAmount", () => {
  it("calculates a percentage discount, rounding down", () => {
    expect(calculateDiscountAmount(10000, { discountType: "percentage", discountValue: 15 })).toBe(
      1500,
    );
    expect(calculateDiscountAmount(9999, { discountType: "percentage", discountValue: 10 })).toBe(
      999,
    );
  });

  it("calculates a fixed amount discount", () => {
    expect(
      calculateDiscountAmount(10000, { discountType: "fixed_amount", discountValue: 2000 }),
    ).toBe(2000);
  });

  it("caps a fixed amount discount at the item price", () => {
    expect(
      calculateDiscountAmount(1000, { discountType: "fixed_amount", discountValue: 2000 }),
    ).toBe(1000);
  });
});

describe("applyCampaignDiscount", () => {
  it("subtracts the discount from the price", () => {
    expect(applyCampaignDiscount(10000, { discountType: "percentage", discountValue: 15 })).toBe(
      8500,
    );
  });
});
