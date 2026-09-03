import { applyCampaignDiscount } from "./campaign-discount";
import { resolveBestCampaign, type CandidateCampaign } from "./campaign-resolution";

export interface LineItemInput {
  price: number;
  discountExempt: boolean;
  applicableCampaigns: CandidateCampaign[];
}

export interface PricedLineItem {
  originalPrice: number;
  finalPrice: number;
  appliedCampaignId: number | null;
}

export function priceLineItem(item: LineItemInput): PricedLineItem {
  if (item.discountExempt) {
    return { originalPrice: item.price, finalPrice: item.price, appliedCampaignId: null };
  }

  const best = resolveBestCampaign(item.price, item.applicableCampaigns);
  if (!best) {
    return { originalPrice: item.price, finalPrice: item.price, appliedCampaignId: null };
  }

  return {
    originalPrice: item.price,
    finalPrice: applyCampaignDiscount(item.price, best),
    appliedCampaignId: best.campaignId,
  };
}

export interface ReservationPriceInput {
  course: LineItemInput;
  options: LineItemInput[];
  nominationFee: number;
}

export interface ReservationPriceResult {
  course: PricedLineItem;
  options: PricedLineItem[];
  nominationFee: number;
  totalPrice: number;
}

export function calculateReservationTotal(input: ReservationPriceInput): ReservationPriceResult {
  const course = priceLineItem(input.course);
  const options = input.options.map(priceLineItem);
  const optionsTotal = options.reduce((sum, o) => sum + o.finalPrice, 0);

  return {
    course,
    options,
    nominationFee: input.nominationFee,
    totalPrice: course.finalPrice + optionsTotal + input.nominationFee,
  };
}
