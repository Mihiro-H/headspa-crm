"use server";

import { prisma } from "@/lib/db";
import type { DiscountType } from "@/lib/reservation/campaign-discount";

export interface CampaignListItem {
  id: number;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  priority: number;
  isPublished: boolean;
  targetStoreId: number | null;
  targetStoreName: string;
  targetNames: string[];
  courseIds: number[];
  categoryIds: number[];
}

export interface ListCampaignsParams {
  includeUnpublished?: boolean;
}

export async function listCampaigns(params?: ListCampaignsParams): Promise<CampaignListItem[]> {
  const campaigns = await prisma.campaign.findMany({
    where: params?.includeUnpublished ? {} : { isPublished: true },
    include: {
      targetStore: true,
      courseTargets: { include: { course: true } },
      categoryTargets: { include: { category: true } },
    },
    orderBy: { id: "desc" },
  });

  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    discountType: c.discountType,
    discountValue: c.discountValue,
    startDate: c.startDate.toISOString().slice(0, 10),
    endDate: c.endDate.toISOString().slice(0, 10),
    priority: c.priority,
    isPublished: c.isPublished,
    targetStoreId: c.targetStoreId,
    targetStoreName: c.targetStore?.name ?? "全店舗",
    targetNames: [
      ...c.courseTargets.map((t) => t.course.name),
      ...c.categoryTargets.map((t) => t.category.name),
    ],
    courseIds: c.courseTargets.map((t) => t.courseId),
    categoryIds: c.categoryTargets.map((t) => t.categoryId),
  }));
}

export interface CreateCampaignParams {
  name: string;
  discountType: DiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  priority: number;
  targetStoreId: number | null;
  courseIds: number[];
  categoryIds: number[];
}

export async function createCampaign(
  params: CreateCampaignParams,
): Promise<{ campaignId: number }> {
  const campaign = await prisma.campaign.create({
    data: {
      name: params.name,
      discountType: params.discountType,
      discountValue: params.discountValue,
      startDate: new Date(`${params.startDate}T00:00:00.000Z`),
      endDate: new Date(`${params.endDate}T00:00:00.000Z`),
      priority: params.priority,
      targetStoreId: params.targetStoreId,
      isPublished: true,
      courseTargets: { create: params.courseIds.map((courseId) => ({ courseId })) },
      categoryTargets: { create: params.categoryIds.map((categoryId) => ({ categoryId })) },
    },
  });

  return { campaignId: campaign.id };
}

export interface UpdateCampaignParams {
  campaignId: number;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  priority: number;
  targetStoreId: number | null;
  courseIds: number[];
  categoryIds: number[];
}

export async function updateCampaign(params: UpdateCampaignParams): Promise<void> {
  await prisma.campaign.update({
    where: { id: params.campaignId },
    data: {
      name: params.name,
      discountType: params.discountType,
      discountValue: params.discountValue,
      startDate: new Date(`${params.startDate}T00:00:00.000Z`),
      endDate: new Date(`${params.endDate}T00:00:00.000Z`),
      priority: params.priority,
      targetStoreId: params.targetStoreId,
      courseTargets: {
        deleteMany: {},
        create: params.courseIds.map((courseId) => ({ courseId })),
      },
      categoryTargets: {
        deleteMany: {},
        create: params.categoryIds.map((categoryId) => ({ categoryId })),
      },
    },
  });
}

// 物理削除はせず、公開フラグを落として一覧から外す（論理削除）。
export async function deleteCampaign(campaignId: number): Promise<void> {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { isPublished: false },
  });
}
