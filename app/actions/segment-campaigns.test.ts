import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSegmentCampaign, listSegmentCampaigns } from "./segment-campaigns";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { sendEmail } from "@/lib/delivery/send-email";
import { sendLineMessage } from "@/lib/delivery/send-line";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findMany: vi.fn() },
    segmentCampaign: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    deliveryTemplate: { findUniqueOrThrow: vi.fn() },
    emailLineLog: { create: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/delivery/send-email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/delivery/send-line", () => ({
  sendLineMessage: vi.fn(),
}));

describe("createSegmentCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unauthenticated caller", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await createSegmentCampaign({
      name: "テスト配信",
      condition: {},
      channelMode: "auto",
      templateId: 1,
      scheduledAt: null,
    });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.member.findMany).not.toHaveBeenCalled();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    const result = await createSegmentCampaign({
      name: "テスト配信",
      condition: {},
      channelMode: "auto",
      templateId: 1,
      scheduledAt: null,
    });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.member.findMany).not.toHaveBeenCalled();
  });

  it("creates a record without sending when scheduledAt is given", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: 1, name: "山田太郎", email: "yamada@example.com", lineUserId: null },
    ] as never);
    vi.mocked(prisma.segmentCampaign.create).mockResolvedValue({ id: 100 } as never);

    const result = await createSegmentCampaign({
      name: "予約配信",
      condition: {},
      channelMode: "auto",
      templateId: 1,
      scheduledAt: "2026-10-01T09:00:00.000Z",
    });

    expect(result).toEqual({ status: "scheduled", campaignId: 100, targetCount: 1 });
    expect(prisma.segmentCampaign.create).toHaveBeenCalledWith({
      data: {
        name: "予約配信",
        conditionJson: {},
        channelMode: "auto",
        templateId: 1,
        scheduledAt: new Date("2026-10-01T09:00:00.000Z"),
        targetCount: 1,
        createdByAdminId: 9,
      },
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendLineMessage).not.toHaveBeenCalled();
    expect(prisma.emailLineLog.create).not.toHaveBeenCalled();
  });

  it("sends immediately and logs success/failure per member when scheduledAt is null", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: 1, name: "山田太郎", email: "yamada@example.com", lineUserId: "line-1" },
      { id: 2, name: "鈴木花子", email: "suzuki@example.com", lineUserId: null },
    ] as never);
    vi.mocked(prisma.segmentCampaign.create).mockResolvedValue({ id: 101 } as never);
    vi.mocked(prisma.deliveryTemplate.findUniqueOrThrow).mockResolvedValue({
      id: 1,
      subject: "{{氏名}}様への大切なお知らせ",
      bodyText: "{{氏名}}様、いつもありがとうございます。",
    } as never);
    vi.mocked(sendLineMessage).mockResolvedValue({ status: "sent" });
    vi.mocked(sendEmail).mockResolvedValue({ status: "failed", error: "boom" });
    vi.mocked(prisma.emailLineLog.create).mockResolvedValue({} as never);
    vi.mocked(prisma.segmentCampaign.update).mockResolvedValue({} as never);

    const result = await createSegmentCampaign({
      name: "即時配信",
      condition: {},
      channelMode: "auto",
      templateId: 1,
      scheduledAt: null,
    });

    expect(result).toEqual({
      status: "sent",
      campaignId: 101,
      targetCount: 2,
      sentCount: 1,
      failedCount: 1,
    });

    expect(sendLineMessage).toHaveBeenCalledWith({
      lineUserId: "line-1",
      body: "山田太郎様、いつもありがとうございます。",
    });
    expect(sendEmail).toHaveBeenCalledWith({
      to: "suzuki@example.com",
      subject: "鈴木花子様への大切なお知らせ",
      body: "鈴木花子様、いつもありがとうございます。",
    });

    expect(prisma.emailLineLog.create).toHaveBeenCalledWith({
      data: {
        memberId: 1,
        channel: "line",
        templateType: "segment",
        segmentCampaignId: 101,
        subject: null,
        sentAt: expect.any(Date),
        status: "success",
      },
    });
    expect(prisma.emailLineLog.create).toHaveBeenCalledWith({
      data: {
        memberId: 2,
        channel: "email",
        templateType: "segment",
        segmentCampaignId: 101,
        subject: "鈴木花子様への大切なお知らせ",
        sentAt: expect.any(Date),
        status: "failed",
      },
    });

    expect(prisma.segmentCampaign.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: { sentAt: expect.any(Date) },
    });
  });

  it("excludes non-LINE-linked members from the target list in line-only mode", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: 1, name: "山田太郎", email: "yamada@example.com", lineUserId: "line-1" },
      { id: 2, name: "鈴木花子", email: "suzuki@example.com", lineUserId: null },
    ] as never);
    vi.mocked(prisma.segmentCampaign.create).mockResolvedValue({ id: 102 } as never);

    const result = await createSegmentCampaign({
      name: "LINE限定配信",
      condition: {},
      channelMode: "line",
      templateId: 1,
      scheduledAt: "2026-10-01T09:00:00.000Z",
    });

    expect(result).toEqual({ status: "scheduled", campaignId: 102, targetCount: 1 });
  });
});

describe("listSegmentCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(listSegmentCampaigns()).rejects.toThrow("unauthorized");
    expect(prisma.segmentCampaign.findMany).not.toHaveBeenCalled();
  });

  it("returns campaign history with the template name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.segmentCampaign.findMany).mockResolvedValue([
      {
        id: 1,
        name: "夏季キャンペーン",
        channelMode: "auto",
        targetCount: 50,
        scheduledAt: null,
        sentAt: new Date("2026-09-01T09:00:00.000Z"),
        template: { name: "夏の特別クーポン" },
      },
    ] as never);

    const result = await listSegmentCampaigns();

    expect(result).toEqual([
      {
        id: 1,
        name: "夏季キャンペーン",
        channelMode: "auto",
        templateName: "夏の特別クーポン",
        targetCount: 50,
        scheduledAt: null,
        sentAt: "2026-09-01T09:00:00.000Z",
      },
    ]);
  });
});
