import { calculateDiscountAmount, type CampaignDiscountInput } from "./campaign-discount";

export interface CandidateCampaign extends CampaignDiscountInput {
  campaignId: number;
  priority: number;
}

export function resolveBestCampaign(
  price: number,
  candidates: CandidateCampaign[],
): CandidateCampaign | null {
  if (candidates.length === 0) return null;

  return candidates.reduce((best, current) => {
    if (current.priority > best.priority) return current;
    if (current.priority < best.priority) return best;

    const bestDiscount = calculateDiscountAmount(price, best);
    const currentDiscount = calculateDiscountAmount(price, current);
    return currentDiscount > bestDiscount ? current : best;
  });
}
