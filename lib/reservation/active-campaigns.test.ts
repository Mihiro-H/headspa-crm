import { describe, it, expect } from "vitest";
import { filterActiveCampaigns, type ActiveCampaignRow } from "./active-campaigns";

const today = new Date("2026-09-15T00:00:00Z");

function campaign(overrides: Partial<ActiveCampaignRow> = {}): ActiveCampaignRow {
  return {
    campaignId: 1,
    priority: 0,
    discountType: "percentage",
    discountValue: 10,
    startDate: new Date("2026-09-01T00:00:00Z"),
    endDate: new Date("2026-09-30T00:00:00Z"),
    isPublished: true,
    ...overrides,
  };
}

describe("filterActiveCampaigns", () => {
  it("includes a published campaign whose date range contains today", () => {
    const result = filterActiveCampaigns([campaign()], today);
    expect(result).toEqual([
      { campaignId: 1, priority: 0, discountType: "percentage", discountValue: 10 },
    ]);
  });

  it("excludes a campaign that hasn't started yet", () => {
    const result = filterActiveCampaigns(
      [campaign({ startDate: new Date("2026-10-01T00:00:00Z"), endDate: new Date("2026-10-31T00:00:00Z") })],
      today,
    );
    expect(result).toEqual([]);
  });

  it("excludes a campaign that has already ended", () => {
    const result = filterActiveCampaigns(
      [campaign({ startDate: new Date("2026-08-01T00:00:00Z"), endDate: new Date("2026-08-31T00:00:00Z") })],
      today,
    );
    expect(result).toEqual([]);
  });

  it("excludes an unpublished campaign", () => {
    const result = filterActiveCampaigns([campaign({ isPublished: false })], today);
    expect(result).toEqual([]);
  });

  it("includes campaigns on the exact boundary dates", () => {
    const result = filterActiveCampaigns(
      [campaign({ startDate: today, endDate: today })],
      today,
    );
    expect(result).toHaveLength(1);
  });
});
