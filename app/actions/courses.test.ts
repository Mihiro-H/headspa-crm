import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCoursesForCategory } from "./courses";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    course: { findMany: vi.fn() },
  },
}));

const now = new Date("2026-09-15T00:00:00Z");

describe("listCoursesForCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the original price when no campaign applies", async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([
      {
        id: 1,
        name: "スタンダード",
        durationEstimateMin: 60,
        price: 8000,
        genderRestriction: "none",
        campaignTargets: [],
        category: { campaignTargets: [] },
      },
    ] as never);

    const result = await listCoursesForCategory(1, 1, now);

    expect(result).toEqual([
      {
        id: 1,
        name: "スタンダード",
        durationEstimateMin: 60,
        originalPrice: 8000,
        finalPrice: 8000,
        genderRestriction: "none",
      },
    ]);
  });

  it("applies an active store-wide course-level campaign", async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([
      {
        id: 1,
        name: "スタンダード",
        durationEstimateMin: 60,
        price: 8000,
        genderRestriction: "none",
        campaignTargets: [
          {
            campaign: {
              id: 5,
              priority: 0,
              discountType: "percentage",
              discountValue: 10,
              startDate: new Date("2026-09-01T00:00:00Z"),
              endDate: new Date("2026-09-30T00:00:00Z"),
              isPublished: true,
              targetStoreId: null,
            },
          },
        ],
        category: { campaignTargets: [] },
      },
    ] as never);

    const result = await listCoursesForCategory(1, 1, now);

    expect(result[0].originalPrice).toBe(8000);
    expect(result[0].finalPrice).toBe(7200);
  });

  it("ignores a campaign scoped to a different store", async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([
      {
        id: 1,
        name: "スタンダード",
        durationEstimateMin: 60,
        price: 8000,
        genderRestriction: "none",
        campaignTargets: [
          {
            campaign: {
              id: 5,
              priority: 0,
              discountType: "percentage",
              discountValue: 10,
              startDate: new Date("2026-09-01T00:00:00Z"),
              endDate: new Date("2026-09-30T00:00:00Z"),
              isPublished: true,
              targetStoreId: 2,
            },
          },
        ],
        category: { campaignTargets: [] },
      },
    ] as never);

    const result = await listCoursesForCategory(1, 1, now);

    expect(result[0].finalPrice).toBe(8000);
  });

  it("applies a category-level campaign", async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([
      {
        id: 1,
        name: "スタンダード",
        durationEstimateMin: 60,
        price: 10000,
        genderRestriction: "none",
        campaignTargets: [],
        category: {
          campaignTargets: [
            {
              campaign: {
                id: 6,
                priority: 0,
                discountType: "fixed_amount",
                discountValue: 1500,
                startDate: new Date("2026-09-01T00:00:00Z"),
                endDate: new Date("2026-09-30T00:00:00Z"),
                isPublished: true,
                targetStoreId: null,
              },
            },
          ],
        },
      },
    ] as never);

    const result = await listCoursesForCategory(1, 1, now);

    expect(result[0].finalPrice).toBe(8500);
  });
});
