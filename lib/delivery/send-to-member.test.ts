import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendToMemberAndLog } from "./send-to-member";
import { prisma } from "@/lib/db";
import { sendEmail } from "./send-email";
import { sendLineMessage } from "./send-line";

vi.mock("@/lib/db", () => ({
  prisma: {
    emailLineLog: { create: vi.fn() },
  },
}));

vi.mock("./send-email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("./send-line", () => ({
  sendLineMessage: vi.fn(),
}));

const now = new Date("2026-09-05T18:00:00.000Z");

describe("sendToMemberAndLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends via LINE and logs a null subject when the member is LINE-linked", async () => {
    vi.mocked(sendLineMessage).mockResolvedValue({ status: "sent" });
    vi.mocked(prisma.emailLineLog.create).mockResolvedValue({} as never);

    const status = await sendToMemberAndLog({
      member: { id: 1, name: "山田太郎", email: "yamada@example.com", lineUserId: "line-1" },
      channelMode: "auto",
      template: { bodyText: "{{氏名}}様、前日リマインドです。", subject: "{{氏名}}様へ" },
      templateType: "reminder",
      tags: { 氏名: "山田太郎" },
      now,
    });

    expect(status).toBe("success");
    expect(sendLineMessage).toHaveBeenCalledWith({
      lineUserId: "line-1",
      body: "山田太郎様、前日リマインドです。",
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.emailLineLog.create).toHaveBeenCalledWith({
      data: {
        memberId: 1,
        channel: "line",
        templateType: "reminder",
        subject: null,
        sentAt: now,
        status: "success",
      },
    });
  });

  it("sends via email and logs the rendered subject when the member is not LINE-linked", async () => {
    vi.mocked(sendEmail).mockResolvedValue({ status: "failed", error: "boom" });
    vi.mocked(prisma.emailLineLog.create).mockResolvedValue({} as never);

    const status = await sendToMemberAndLog({
      member: { id: 2, name: "鈴木花子", email: "suzuki@example.com", lineUserId: null },
      channelMode: "auto",
      template: { bodyText: "{{氏名}}様、前日リマインドです。", subject: "{{氏名}}様へ" },
      templateType: "reminder",
      tags: { 氏名: "鈴木花子" },
      now,
    });

    expect(status).toBe("failed");
    expect(sendEmail).toHaveBeenCalledWith({
      to: "suzuki@example.com",
      subject: "鈴木花子様へ",
      body: "鈴木花子様、前日リマインドです。",
    });
    expect(prisma.emailLineLog.create).toHaveBeenCalledWith({
      data: {
        memberId: 2,
        channel: "email",
        templateType: "reminder",
        subject: "鈴木花子様へ",
        sentAt: now,
        status: "failed",
      },
    });
  });
});
