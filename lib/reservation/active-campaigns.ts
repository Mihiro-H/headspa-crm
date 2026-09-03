import type { DiscountType } from "./campaign-discount";
import type { CandidateCampaign } from "./campaign-resolution";

export interface ActiveCampaignRow {
  campaignId: number;
  priority: number;
  discountType: DiscountType;
  discountValue: number;
  startDate: Date;
  endDate: Date;
  isPublished: boolean;
}

export function filterActiveCampaigns(
  campaigns: ActiveCampaignRow[],
  today: Date,
): CandidateCampaign[] {
  return campaigns
    .filter((c) => c.isPublished && c.startDate <= today && today <= c.endDate)
    .map((c) => ({
      campaignId: c.campaignId,
      priority: c.priority,
      discountType: c.discountType,
      discountValue: c.discountValue,
    }));
}
