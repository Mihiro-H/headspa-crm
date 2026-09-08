import { describe, it, expect } from "vitest";
import { resolveCourseCampaigns, type CourseWithCampaignTargets } from "./course-campaigns";

const now = new Date("2026-09-15T00:00:00Z");

function course(overrides: Partial<CourseWithCampaignTargets> = {}): CourseWithCampaignTargets {
  return {
    campaignTargets: [],
    category: { campaignTargets: [] },
    ...overrides,
  };
}

describe("resolveCourseCampaigns", () => {
  it("returns an empty array when there are no campaigns", () => {
    expect(resolveCourseCampaigns(course(), 1, now)).toEqual([]);
  });

  it("includes an active store-wide course-level campaign (no store targets)", () => {
    const result = resolveCourseCampaigns(
      course({
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
              storeTargets: [],
            },
          },
        ],
      }),
      1,
      now,
    );

    expect(result).toEqual([
      { campaignId: 5, priority: 0, discountType: "percentage", discountValue: 10 },
    ]);
  });

  it("includes a campaign whose store targets include the requested store", () => {
    const result = resolveCourseCampaigns(
      course({
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
              storeTargets: [{ storeId: 1 }, { storeId: 3 }],
            },
          },
        ],
      }),
      1,
      now,
    );

    expect(result).toEqual([
      { campaignId: 5, priority: 0, discountType: "percentage", discountValue: 10 },
    ]);
  });

  it("excludes a campaign whose store targets do not include the requested store", () => {
    const result = resolveCourseCampaigns(
      course({
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
              storeTargets: [{ storeId: 2 }],
            },
          },
        ],
      }),
      1,
      now,
    );

    expect(result).toEqual([]);
  });

  it("includes an active category-level campaign", () => {
    const result = resolveCourseCampaigns(
      course({
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
                storeTargets: [],
              },
            },
          ],
        },
      }),
      1,
      now,
    );

    expect(result).toEqual([
      { campaignId: 6, priority: 0, discountType: "fixed_amount", discountValue: 1500 },
    ]);
  });

  it("excludes a campaign outside its active date range", () => {
    const result = resolveCourseCampaigns(
      course({
        campaignTargets: [
          {
            campaign: {
              id: 5,
              priority: 0,
              discountType: "percentage",
              discountValue: 10,
              startDate: new Date("2026-10-01T00:00:00Z"),
              endDate: new Date("2026-10-31T00:00:00Z"),
              isPublished: true,
              storeTargets: [],
            },
          },
        ],
      }),
      1,
      now,
    );

    expect(result).toEqual([]);
  });
});
