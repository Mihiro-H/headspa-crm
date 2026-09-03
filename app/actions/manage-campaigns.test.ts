import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCampaigns, createCampaign } from "./manage-campaigns";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    campaign: { findMany: vi.fn(), create: vi.fn() },
  },
}));

describe("listCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns campaigns with target names and store scope", async () => {
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
        targetStore: null,
        courseTargets: [{ course: { name: "スタンダード" } }],
        categoryTargets: [],
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
        targetStoreName: "全店舗",
        targetNames: ["スタンダード"],
      },
    ]);
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
