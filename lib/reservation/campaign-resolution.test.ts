import { describe, it, expect } from "vitest";
import { resolveBestCampaign, type CandidateCampaign } from "./campaign-resolution";

describe("resolveBestCampaign", () => {
  it("returns null when there are no candidates", () => {
    expect(resolveBestCampaign(10000, [])).toBeNull();
  });

  it("returns the only candidate when there is one", () => {
    const candidates: CandidateCampaign[] = [
      { campaignId: 1, priority: 0, discountType: "percentage", discountValue: 10 },
    ];
    expect(resolveBestCampaign(10000, candidates)?.campaignId).toBe(1);
  });

  it("picks the higher-priority campaign regardless of discount size", () => {
    const candidates: CandidateCampaign[] = [
      { campaignId: 1, priority: 1, discountType: "percentage", discountValue: 50 },
      { campaignId: 2, priority: 2, discountType: "fixed_amount", discountValue: 100 },
    ];
    expect(resolveBestCampaign(10000, candidates)?.campaignId).toBe(2);
  });

  it("picks the campaign with the larger discount amount when priority ties", () => {
    const candidates: CandidateCampaign[] = [
      { campaignId: 1, priority: 1, discountType: "fixed_amount", discountValue: 1000 },
      { campaignId: 2, priority: 1, discountType: "percentage", discountValue: 20 },
    ];
    // price 10000: campaign1 = 1000 off, campaign2 = 2000 off -> campaign2 wins
    expect(resolveBestCampaign(10000, candidates)?.campaignId).toBe(2);
  });
});
