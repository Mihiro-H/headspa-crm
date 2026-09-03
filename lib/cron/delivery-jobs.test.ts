import { describe, it, expect, vi, beforeEach } from "vitest";
import { runReminderJob, runBirthdayJob, runReminderRecheckJob } from "./delivery-jobs";
import { prisma } from "@/lib/db";
import { sendToMemberAndLog } from "@/lib/delivery/send-to-member";

vi.mock("@/lib/db", () => ({
  prisma: {
    autoDeliverySetting: { findFirst: vi.fn() },
    reservation: { findMany: vi.fn() },
    member: { findMany: vi.fn() },
    emailLineLog: { findMany: vi.fn() },
    cronJobLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/delivery/send-to-member", () => ({
  sendToMemberAndLog: vi.fn(),
}));

const now = new Date("2026-09-05T18:00:00.000Z");

describe("runReminderJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.cronJobLog.create).mockResolvedValue({} as never);
  });

  it("does nothing and logs zero targets when no active reminder setting exists", async () => {
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue(null as never);

    await runReminderJob(now);

    expect(prisma.reservation.findMany).not.toHaveBeenCalled();
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "reminder", executedAt: now, status: "success", targetCount: 0 },
    });
  });

  it("sends a reminder to every member with a confirmed reservation tomorrow", async () => {
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue({
      channelMode: "auto",
      template: {
        bodyText: "{{氏名}}様、{{店舗名}}にて明日{{予約時刻}}よりお待ちしております。",
        subject: null,
      },
    } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      {
        member: { id: 1, name: "山田太郎", email: "yamada@example.com", lineUserId: null },
        store: { name: "フォレスパ 渋谷店" },
        startTime: new Date("1970-01-01T10:30:00.000Z"),
      },
    ] as never);
    vi.mocked(sendToMemberAndLog).mockResolvedValue("success");

    await runReminderJob(now);

    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: { status: "confirmed", reservationDate: new Date("2026-09-06T00:00:00.000Z") },
      include: { member: true, store: true },
    });
    expect(sendToMemberAndLog).toHaveBeenCalledWith({
      member: { id: 1, name: "山田太郎", email: "yamada@example.com", lineUserId: null },
      channelMode: "auto",
      template: {
        bodyText: "{{氏名}}様、{{店舗名}}にて明日{{予約時刻}}よりお待ちしております。",
        subject: null,
      },
      templateType: "reminder",
      tags: { 氏名: "山田太郎", 店舗名: "フォレスパ 渋谷店", 予約時刻: "10:30" },
      now,
    });
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "reminder", executedAt: now, status: "success", targetCount: 1 },
    });
  });
});

describe("runBirthdayJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.cronJobLog.create).mockResolvedValue({} as never);
  });

  it("sends a birthday message only to members born in the current month", async () => {
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue({
      channelMode: "auto",
      template: { bodyText: "{{氏名}}様、お誕生日おめでとうございます。", subject: null },
    } as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      {
        id: 1,
        name: "山田太郎",
        email: "yamada@example.com",
        lineUserId: null,
        birthDate: new Date("1990-09-15T00:00:00.000Z"),
      },
      {
        id: 2,
        name: "鈴木花子",
        email: "suzuki@example.com",
        lineUserId: null,
        birthDate: new Date("1990-03-15T00:00:00.000Z"),
      },
    ] as never);
    vi.mocked(sendToMemberAndLog).mockResolvedValue("success");

    await runBirthdayJob(now);

    expect(sendToMemberAndLog).toHaveBeenCalledTimes(1);
    expect(sendToMemberAndLog).toHaveBeenCalledWith(
      expect.objectContaining({ member: expect.objectContaining({ id: 1 }) }),
    );
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "birthday", executedAt: now, status: "success", targetCount: 1 },
    });
  });
});

describe("runReminderRecheckJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.cronJobLog.create).mockResolvedValue({} as never);
  });

  it("retries sending to members whose reminder failed earlier today", async () => {
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue({
      channelMode: "auto",
      template: { bodyText: "{{氏名}}様、前日リマインドです。", subject: null },
    } as never);
    vi.mocked(prisma.emailLineLog.findMany).mockResolvedValue([
      { member: { id: 2, name: "鈴木花子", email: "suzuki@example.com", lineUserId: null } },
    ] as never);
    vi.mocked(sendToMemberAndLog).mockResolvedValue("success");

    await runReminderRecheckJob(now);

    expect(prisma.emailLineLog.findMany).toHaveBeenCalledWith({
      where: {
        templateType: "reminder",
        status: "failed",
        sentAt: { gte: new Date("2026-09-05T00:00:00.000Z") },
      },
      include: { member: true },
    });
    expect(sendToMemberAndLog).toHaveBeenCalledWith(
      expect.objectContaining({ member: expect.objectContaining({ id: 2 }) }),
    );
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "reminder_recheck", executedAt: now, status: "success", targetCount: 1 },
    });
  });
});
