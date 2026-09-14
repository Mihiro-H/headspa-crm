import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendReservationConfirmation } from "./send-reservation-confirmation";
import { prisma } from "@/lib/db";
import { sendToMemberAndLog } from "./send-to-member";

vi.mock("@/lib/db", () => ({
  prisma: {
    autoDeliverySetting: { findFirst: vi.fn() },
  },
}));

vi.mock("./send-to-member", () => ({
  sendToMemberAndLog: vi.fn(),
}));

const member = {
  id: 1,
  name: "山田太郎",
  email: "yamada@example.com",
  lineUserId: null,
  emailNotificationEnabled: true,
  lineNotificationEnabled: true,
};

const now = new Date("2026-09-14T10:00:00.000Z");

describe("sendReservationConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://foresupa.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does nothing and returns not_configured when no active confirmation setting exists", async () => {
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue(null as never);

    const result = await sendReservationConfirmation({
      member,
      storeName: "フォレスパ 渋谷店",
      reservationDateLabel: "2026年9月20日（日）",
      startTimeLabel: "11:00",
      now,
    });

    expect(result).toBe("not_configured");
    expect(sendToMemberAndLog).not.toHaveBeenCalled();
  });

  it("looks up the active confirmation setting specifically (not birthday/reminder)", async () => {
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue(null as never);

    await sendReservationConfirmation({
      member,
      storeName: "フォレスパ 渋谷店",
      reservationDateLabel: "2026年9月20日（日）",
      startTimeLabel: "11:00",
      now,
    });

    expect(prisma.autoDeliverySetting.findFirst).toHaveBeenCalledWith({
      where: { type: "confirmation", isActive: true },
      include: { template: true },
    });
  });

  it("sends via sendToMemberAndLog using the configured channel mode and template, with reservation tags", async () => {
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue({
      channelMode: "auto",
      template: {
        bodyText: "{{氏名}}様、{{店舗名}}のご予約（{{予約日}} {{予約時刻}}〜）を承りました。",
        subject: "ご予約確定のお知らせ",
      },
    } as never);
    vi.mocked(sendToMemberAndLog).mockResolvedValue("success");

    const result = await sendReservationConfirmation({
      member,
      storeName: "フォレスパ 渋谷店",
      reservationDateLabel: "2026年9月20日（日）",
      startTimeLabel: "11:00",
      now,
    });

    expect(result).toBe("success");
    expect(sendToMemberAndLog).toHaveBeenCalledWith({
      member,
      channelMode: "auto",
      template: {
        bodyText: "{{氏名}}様、{{店舗名}}のご予約（{{予約日}} {{予約時刻}}〜）を承りました。",
        subject: "ご予約確定のお知らせ",
      },
      templateType: "confirmation",
      tags: {
        氏名: "山田太郎",
        店舗名: "フォレスパ 渋谷店",
        予約日: "2026年9月20日（日）",
        予約時刻: "11:00",
        マイページURL: "https://foresupa.example.com/mypage",
      },
      now,
    });
  });

  it("falls back to localhost for the mypage URL when NEXT_PUBLIC_APP_URL is not set", async () => {
    vi.unstubAllEnvs();
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue({
      channelMode: "auto",
      template: { bodyText: "{{マイページURL}}", subject: null },
    } as never);
    vi.mocked(sendToMemberAndLog).mockResolvedValue("success");

    await sendReservationConfirmation({
      member,
      storeName: "フォレスパ 渋谷店",
      reservationDateLabel: "2026年9月20日（日）",
      startTimeLabel: "11:00",
      now,
    });

    expect(sendToMemberAndLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: expect.objectContaining({ マイページURL: "http://localhost:3000/mypage" }),
      }),
    );
  });

  it("propagates a failed send result from sendToMemberAndLog", async () => {
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue({
      channelMode: "email",
      template: { bodyText: "本文", subject: "件名" },
    } as never);
    vi.mocked(sendToMemberAndLog).mockResolvedValue("failed");

    const result = await sendReservationConfirmation({
      member,
      storeName: "フォレスパ 渋谷店",
      reservationDateLabel: "2026年9月20日（日）",
      startTimeLabel: "11:00",
      now,
    });

    expect(result).toBe("failed");
  });
});
