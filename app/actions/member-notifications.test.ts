import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMemberNotifications } from "./member-notifications";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    emailLineLog: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("getMemberNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for an unauthenticated caller", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await getMemberNotifications();

    expect(result).toBeNull();
    expect(prisma.emailLineLog.findMany).not.toHaveBeenCalled();
  });

  it("returns null for a non-member session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "hq" } } as never);

    const result = await getMemberNotifications();

    expect(result).toBeNull();
  });

  it("returns only successful deliveries for the authenticated member, newest first", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.emailLineLog.findMany).mockResolvedValue([
      {
        id: 101,
        templateType: "birthday",
        channel: "email",
        subject: "お誕生日おめでとうございます",
        sentAt: new Date("2026-06-01T00:00:00.000Z"),
      },
      {
        id: 100,
        templateType: "reminder",
        channel: "line",
        subject: null,
        sentAt: new Date("2026-05-01T00:00:00.000Z"),
      },
    ] as never);

    const result = await getMemberNotifications();

    expect(result).toEqual([
      {
        id: 101,
        templateType: "birthday",
        channel: "email",
        subject: "お誕生日おめでとうございます",
        sentAt: "2026-06-01T00:00:00.000Z",
      },
      {
        id: 100,
        templateType: "reminder",
        channel: "line",
        subject: null,
        sentAt: "2026-05-01T00:00:00.000Z",
      },
    ]);
    expect(prisma.emailLineLog.findMany).toHaveBeenCalledWith({
      where: { memberId: 7, status: "success" },
      orderBy: { sentAt: "desc" },
    });
  });
});
