import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from "./manage-campaigns";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    campaign: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

describe("listCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns published campaigns with target ids and names by default", async () => {
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      {
        id: 1,
        name: "秋の頭皮ケアキャンペーン",
        discountType: "percentage",
        discountValue: 10,
        startDate: new Date("2026-09-01T00:00:00Z"),
        endDate: new Date("2026-09-30T00:00:00Z"),
        priority: 0,
        isPublished: true,
        targetStoreId: null,
        targetStore: null,
        courseTargets: [{ courseId: 5, course: { name: "スタンダード" } }],
        categoryTargets: [{ categoryId: 9, category: { name: "頭皮ケア重点" } }],
      },
    ] as never);

    const result = await listCampaigns();

    expect(result).toEqual([
      {
        id: 1,
        name: "秋の頭皮ケアキャンペーン",
        discountType: "percentage",
        discountValue: 10,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        priority: 0,
        isPublished: true,
        targetStoreId: null,
        targetStoreName: "全店舗",
        targetNames: ["スタンダード", "頭皮ケア重点"],
        courseIds: [5],
        categoryIds: [9],
      },
    ]);
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true } }),
    );
  });

  it("includes unpublished campaigns when requested", async () => {
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([] as never);

    await listCampaigns({ includeUnpublished: true });

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});

describe("createCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a campaign with course and category targets", async () => {
    vi.mocked(prisma.campaign.create).mockResolvedValue({ id: 10 } as never);

    const result = await createCampaign({
      name: "秋の頭皮ケアキャンペーン",
      discountType: "percentage",
      discountValue: 10,
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      priority: 0,
      targetStoreId: null,
      courseIds: [1, 2],
      categoryIds: [3],
    });

    expect(result).toEqual({ campaignId: 10 });
    expect(prisma.campaign.create).toHaveBeenCalledWith({
      data: {
        name: "秋の頭皮ケアキャンペーン",
        discountType: "percentage",
        discountValue: 10,
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2026-09-30T00:00:00.000Z"),
        priority: 0,
        targetStoreId: null,
        isPublished: true,
        courseTargets: { create: [{ courseId: 1 }, { courseId: 2 }] },
        categoryTargets: { create: [{ categoryId: 3 }] },
      },
    });
  });
});

describe("updateCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces campaign fields and targets", async () => {
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as never);

    await updateCampaign({
      campaignId: 1,
      name: "更新後キャンペーン",
      discountType: "fixed_amount",
      discountValue: 1000,
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      priority: 1,
      targetStoreId: 2,
      courseIds: [4],
      categoryIds: [],
    });

    expect(prisma.campaign.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: "更新後キャンペーン",
        discountType: "fixed_amount",
        discountValue: 1000,
        startDate: new Date("2026-10-01T00:00:00.000Z"),
        endDate: new Date("2026-10-31T00:00:00.000Z"),
        priority: 1,
        targetStoreId: 2,
        courseTargets: { deleteMany: {}, create: [{ courseId: 4 }] },
        categoryTargets: { deleteMany: {}, create: [] },
      },
    });
  });
});

describe("deleteCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unpublishes the campaign instead of deleting the row", async () => {
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as never);

    await deleteCampaign(1);

    expect(prisma.campaign.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isPublished: false },
    });
  });
});
