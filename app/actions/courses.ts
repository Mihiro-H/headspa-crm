"use server";

import { prisma } from "@/lib/db";
import { resolveCourseCampaigns } from "./course-campaigns";
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
    const active = resolveCourseCampaigns(course, storeId, now);
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
