import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "./notifications";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("listNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(listNotifications(null)).rejects.toThrow("unauthorized");
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
  });

  it("returns notifications ordered by newest first", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      {
        id: 1,
        type: "new_reservation",
        message: "新規WEB予約：2026-09-10 10:30〜",
        reservationId: 55,
        isRead: false,
        createdAt: new Date("2026-09-05T10:30:00.000Z"),
        storeId: 2,
      },
    ] as never);

    const result = await listNotifications(null);

    expect(result).toEqual([
      {
        id: 1,
        type: "new_reservation",
        message: "新規WEB予約：2026-09-10 10:30〜",
        reservationId: 55,
        isRead: false,
        createdAt: "2026-09-05T10:30:00.000Z",
        storeId: 2,
      },
    ]);
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  it("filters by store when a storeId is given", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never);

    await listNotifications(2);

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { storeId: 2 },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });
});

describe("getUnreadNotificationCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    await expect(getUnreadNotificationCount(null)).rejects.toThrow("unauthorized");
  });

  it("counts unread notifications", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.notification.count).mockResolvedValue(3 as never);

    const result = await getUnreadNotificationCount(null);

    expect(result).toBe(3);
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { isRead: false } });
  });
});

describe("markNotificationAsRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(markNotificationAsRead(1)).rejects.toThrow("unauthorized");
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it("marks a notification as read", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.notification.update).mockResolvedValue({} as never);

    await markNotificationAsRead(1);

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isRead: true },
    });
  });
});

describe("markAllNotificationsAsRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks all unread notifications as read", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({} as never);

    await markAllNotificationsAsRead(null);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { isRead: false },
      data: { isRead: true },
    });
  });
});
