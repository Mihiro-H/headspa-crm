import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  republishCampaign,
} from "./manage-campaigns";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    campaign: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

describe("listCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.campaign.count).mockResolvedValue(0);
  });

  it("returns published campaigns with target ids and names, including multiple store targets", async () => {
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
        storeTargets: [
          { storeId: 1, store: { name: "フォレスパ 東京丸の内本店" } },
          { storeId: 2, store: { name: "フォレスパ 渋谷店" } },
        ],
        courseTargets: [{ courseId: 5, course: { name: "スタンダード" } }],
        categoryTargets: [{ categoryId: 9, category: { name: "頭皮ケア重点" } }],
      },
    ] as never);
    vi.mocked(prisma.campaign.count).mockResolvedValue(1);

    const result = await listCampaigns();

    expect(result).toEqual({
      items: [
        {
          id: 1,
          name: "秋の頭皮ケアキャンペーン",
          discountType: "percentage",
          discountValue: 10,
          startDate: "2026-09-01",
          endDate: "2026-09-30",
          priority: 0,
          isPublished: true,
          storeIds: [1, 2],
          storeNames: ["フォレスパ 東京丸の内本店", "フォレスパ 渋谷店"],
          targetNames: ["スタンダード", "頭皮ケア重点"],
          courseIds: [5],
          categoryIds: [9],
        },
      ],
      totalCount: 1,
    });
  });

  it("returns storeNames of [\"全店舗\"] when no store targets are set", async () => {
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      {
        id: 2,
        name: "全店舗キャンペーン",
        discountType: "fixed_amount",
        discountValue: 500,
        startDate: new Date("2026-09-01T00:00:00Z"),
        endDate: new Date("2026-09-30T00:00:00Z"),
        priority: 0,
        isPublished: true,
        storeTargets: [],
        courseTargets: [],
        categoryTargets: [],
      },
    ] as never);

    const result = await listCampaigns();

    expect(result.items[0].storeIds).toEqual([]);
    expect(result.items[0].storeNames).toEqual(["全店舗"]);
  });

  it("includes unpublished campaigns when requested", async () => {
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([] as never);

    await listCampaigns({ includeUnpublished: true });

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("applies skip/take based on the requested page", async () => {
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.campaign.count).mockResolvedValue(33);

    const result = await listCampaigns({ page: 2 });

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
    expect(result.totalCount).toBe(33);
  });
});

describe("createCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a campaign with course, category, and store targets", async () => {
    vi.mocked(prisma.campaign.create).mockResolvedValue({ id: 10 } as never);

    const result = await createCampaign({
      name: "秋の頭皮ケアキャンペーン",
      discountType: "percentage",
      discountValue: 10,
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      priority: 0,
      storeIds: [1, 2],
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
        isPublished: true,
        storeTargets: { create: [{ storeId: 1 }, { storeId: 2 }] },
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

  it("replaces campaign fields and targets, including store targets", async () => {
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as never);

    await updateCampaign({
      campaignId: 1,
      name: "更新後キャンペーン",
      discountType: "fixed_amount",
      discountValue: 1000,
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      priority: 1,
      storeIds: [2],
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
        storeTargets: { deleteMany: {}, create: [{ storeId: 2 }] },
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

describe("republishCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-publishes a previously deleted campaign", async () => {
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as never);

    await republishCampaign(1);

    expect(prisma.campaign.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isPublished: true },
    });
  });
});
