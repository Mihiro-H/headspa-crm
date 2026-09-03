export type DiscountType = "percentage" | "fixed_amount";

export interface CampaignDiscountInput {
  discountType: DiscountType;
  discountValue: number;
}

export function calculateDiscountAmount(price: number, campaign: CampaignDiscountInput): number {
  if (campaign.discountType === "percentage") {
    return Math.floor((price * campaign.discountValue) / 100);
  }
  return Math.min(campaign.discountValue, price);
}

export function applyCampaignDiscount(price: number, campaign: CampaignDiscountInput): number {
  return price - calculateDiscountAmount(price, campaign);
}
