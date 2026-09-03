"use server";

import { prisma } from "@/lib/db";
import { filterActiveCampaigns, type ActiveCampaignRow } from "@/lib/reservation/active-campaigns";
import { priceLineItem } from "@/lib/reservation/total-price";
import type { GenderRestriction } from "@/lib/reservation/gender-restriction";

export interface CourseListItem {
  id: number;
  name: string;
  durationEstimateMin: number;
  originalPrice: number;
  finalPrice: number;
  genderRestriction: GenderRestriction;
}

interface RawCampaign extends ActiveCampaignRow {
  targetStoreId: number | null;
}

function eligibleForStore(campaigns: RawCampaign[], storeId: number): ActiveCampaignRow[] {
  return campaigns.filter((c) => c.targetStoreId === null || c.targetStoreId === storeId);
}

export async function listCoursesForCategory(
  categoryId: number,
  storeId: number,
  now: Date = new Date(),
): Promise<CourseListItem[]> {
  const courses = await prisma.course.findMany({
    where: { categoryId, isPublished: true },
    orderBy: { sortOrder: "asc" },
    include: {
      campaignTargets: { include: { campaign: true } },
      category: { include: { campaignTargets: { include: { campaign: true } } } },
    },
  });

  return courses.map((course) => {
    const courseCampaigns = course.campaignTargets.map((t) => t.campaign);
    const categoryCampaigns = course.category.campaignTargets.map((t) => t.campaign);
    const allCampaigns: RawCampaign[] = [...courseCampaigns, ...categoryCampaigns].map((c) => ({
      campaignId: c.id,
      priority: c.priority,
      discountType: c.discountType,
      discountValue: c.discountValue,
      startDate: c.startDate,
      endDate: c.endDate,
      isPublished: c.isPublished,
      targetStoreId: c.targetStoreId,
    }));

    const active = filterActiveCampaigns(eligibleForStore(allCampaigns, storeId), now);
    const priced = priceLineItem({ price: course.price, discountExempt: false, applicableCampaigns: active });

    return {
      id: course.id,
      name: course.name,
      durationEstimateMin: course.durationEstimateMin,
      originalPrice: priced.originalPrice,
      finalPrice: priced.finalPrice,
      genderRestriction: course.genderRestriction,
    };
  });
}
