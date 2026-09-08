import { filterActiveCampaigns, type ActiveCampaignRow } from "@/lib/reservation/active-campaigns";
import type { DiscountType } from "@/lib/reservation/campaign-discount";
import type { CandidateCampaign } from "@/lib/reservation/campaign-resolution";

export interface RawCampaign {
  id: number;
  priority: number;
  discountType: DiscountType;
  discountValue: number;
  startDate: Date;
  endDate: Date;
  isPublished: boolean;
  storeTargets: { storeId: number }[];
}

export interface CourseWithCampaignTargets {
  campaignTargets: { campaign: RawCampaign }[];
  category: { campaignTargets: { campaign: RawCampaign }[] };
}

function toActiveCampaignRow(c: RawCampaign): ActiveCampaignRow & { storeTargetIds: number[] } {
  return {
    campaignId: c.id,
    priority: c.priority,
    discountType: c.discountType,
    discountValue: c.discountValue,
    startDate: c.startDate,
    endDate: c.endDate,
    isPublished: c.isPublished,
    storeTargetIds: c.storeTargets.map((t) => t.storeId),
  };
}

/**
 * Resolves the set of currently-active campaigns applicable to a course for a
 * given store, combining course-level and category-level campaign targets.
 * Shared by `courses.ts` (menu display pricing) and `create-temp-hold.ts`
 * (actual reservation pricing) so the two stay in sync.
 */
export function resolveCourseCampaigns(
  course: CourseWithCampaignTargets,
  storeId: number,
  now: Date,
): CandidateCampaign[] {
  const courseCampaigns = course.campaignTargets.map((t) => t.campaign);
  const categoryCampaigns = course.category.campaignTargets.map((t) => t.campaign);
  const eligible = [...courseCampaigns, ...categoryCampaigns]
    .map(toActiveCampaignRow)
    .filter((c) => c.storeTargetIds.length === 0 || c.storeTargetIds.includes(storeId));

  return filterActiveCampaigns(eligible, now);
}
