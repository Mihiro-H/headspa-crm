import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMemberReservationHistory } from "./member-reservation-history";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("getMemberReservationHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for an unauthenticated caller", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await getMemberReservationHistory();

    expect(result).toBeNull();
    expect(prisma.reservation.findMany).not.toHaveBeenCalled();
  });

  it("returns the authenticated member's reservation history, newest first", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      {
        id: 40,
        reservationDate: new Date("2026-08-01T00:00:00.000Z"),
        totalPrice: 9000,
        status: "completed",
        cancellationDeadline: new Date("2026-07-31T23:59:59.000Z"),
        store: { name: "フォレスパ 渋谷店" },
        staff: { name: "佐藤 由紀" },
        items: [{ itemType: "course", course: { name: "頭皮ケアプレミアム" } }],
      },
    ] as never);

    const result = await getMemberReservationHistory(new Date("2026-08-05T00:00:00.000Z"));

    expect(result).toEqual([
      {
        id: 40,
        date: "2026-08-01",
        storeName: "フォレスパ 渋谷店",
        courseName: "頭皮ケアプレミアム",
        staffName: "佐藤 由紀",
        totalPrice: 9000,
        status: "completed",
        canModify: false,
      },
    ]);
    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: { memberId: 7, status: { in: ["completed", "confirmed", "cancelled", "no_show"] } },
      orderBy: { reservationDate: "desc" },
      include: { store: true, staff: true, items: { include: { course: true } } },
    });
  });

  it("marks canModify true for a confirmed reservation before its cancellation deadline", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      {
        id: 41,
        reservationDate: new Date("2026-09-10T00:00:00.000Z"),
        totalPrice: 8000,
        status: "confirmed",
        cancellationDeadline: new Date("2026-09-09T23:59:59.000Z"),
        store: { name: "フォレスパ 渋谷店" },
        staff: null,
        items: [{ itemType: "course", course: { name: "頭皮ケアスタンダード" } }],
      },
    ] as never);

    const result = await getMemberReservationHistory(new Date("2026-09-01T00:00:00.000Z"));

    expect(result?.[0].canModify).toBe(true);
  });

  it("marks canModify false for a confirmed reservation past its cancellation deadline", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      {
        id: 42,
        reservationDate: new Date("2026-09-10T00:00:00.000Z"),
        totalPrice: 8000,
        status: "confirmed",
        cancellationDeadline: new Date("2026-09-09T23:59:59.000Z"),
        store: { name: "フォレスパ 渋谷店" },
        staff: null,
        items: [{ itemType: "course", course: { name: "頭皮ケアスタンダード" } }],
      },
    ] as never);

    const result = await getMemberReservationHistory(new Date("2026-09-10T00:00:00.000Z"));

    expect(result?.[0].canModify).toBe(false);
  });
});
