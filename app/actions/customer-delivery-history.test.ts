import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCustomerDeliveryHistory } from "./customer-delivery-history";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    emailLineLog: { findMany: vi.fn() },
  },
}));

describe("getCustomerDeliveryHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps delivery logs, joining the segment campaign name when present", async () => {
    vi.mocked(prisma.emailLineLog.findMany).mockResolvedValue([
      {
        id: 101,
        channel: "email",
        templateType: "segment",
        subject: "秋の指名キャンペーンのご案内",
        sentAt: new Date("2026-09-01T00:00:00.000Z"),
        status: "success",
        segmentCampaignId: 7,
        segmentCampaign: { id: 7, name: "秋の指名キャンペーン" },
      },
      {
        id: 100,
        channel: "line",
        templateType: "birthday",
        subject: null,
        sentAt: new Date("2026-04-15T00:00:00.000Z"),
        status: "failed",
        segmentCampaignId: null,
        segmentCampaign: null,
      },
    ] as never);

    const result = await getCustomerDeliveryHistory(1);

    expect(result).toEqual([
      {
        id: 101,
        channel: "email",
        templateType: "segment",
        subject: "秋の指名キャンペーンのご案内",
        sentAt: "2026-09-01T00:00:00.000Z",
        status: "success",
        segmentCampaignId: 7,
        segmentCampaignName: "秋の指名キャンペーン",
      },
      {
        id: 100,
        channel: "line",
        templateType: "birthday",
        subject: null,
        sentAt: "2026-04-15T00:00:00.000Z",
        status: "failed",
        segmentCampaignId: null,
        segmentCampaignName: null,
      },
    ]);
    expect(prisma.emailLineLog.findMany).toHaveBeenCalledWith({
      where: { memberId: 1 },
      include: { segmentCampaign: true },
      orderBy: { sentAt: "desc" },
    });
  });
});
