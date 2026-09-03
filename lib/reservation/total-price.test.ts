import { describe, it, expect } from "vitest";
import { priceLineItem, calculateReservationTotal, type LineItemInput } from "./total-price";

describe("priceLineItem", () => {
  it("returns the original price when no campaign applies", () => {
    const item: LineItemInput = { price: 10000, discountExempt: false, applicableCampaigns: [] };
    expect(priceLineItem(item)).toEqual({
      originalPrice: 10000,
      finalPrice: 10000,
      appliedCampaignId: null,
    });
  });

  it("applies the best campaign discount", () => {
    const item: LineItemInput = {
      price: 10000,
      discountExempt: false,
      applicableCampaigns: [
        { campaignId: 1, priority: 0, discountType: "percentage", discountValue: 20 },
      ],
    };
    expect(priceLineItem(item)).toEqual({
      originalPrice: 10000,
      finalPrice: 8000,
      appliedCampaignId: 1,
    });
  });

  it("ignores campaigns when the item is discount-exempt", () => {
    const item: LineItemInput = {
      price: 3000,
      discountExempt: true,
      applicableCampaigns: [
        { campaignId: 1, priority: 0, discountType: "percentage", discountValue: 50 },
      ],
    };
    expect(priceLineItem(item)).toEqual({
      originalPrice: 3000,
      finalPrice: 3000,
      appliedCampaignId: null,
    });
  });
});

describe("calculateReservationTotal", () => {
  it("sums course + options + nomination fee after discounts", () => {
    const result = calculateReservationTotal({
      course: { price: 10000, discountExempt: false, applicableCampaigns: [] },
      options: [
        { price: 2000, discountExempt: false, applicableCampaigns: [] },
        { price: 1000, discountExempt: true, applicableCampaigns: [] },
      ],
      nominationFee: 500,
    });

    expect(result.totalPrice).toBe(13500);
    expect(result.course.finalPrice).toBe(10000);
    expect(result.options).toHaveLength(2);
    expect(result.nominationFee).toBe(500);
  });
});
