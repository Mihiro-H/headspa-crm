import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDashboardSummary } from "./dashboard-summary";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findMany: vi.fn() },
    adminStore: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

const today = new Date("2026-09-15T00:00:00Z");

describe("getDashboardSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts today's confirmed/completed reservations and sums their price for an unrestricted (hq) admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "hq" } } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      { totalPrice: 8000 },
      { totalPrice: 12000 },
    ] as never);

    const result = await getDashboardSummary(1, today);

    expect(result).toEqual({ todayReservationCount: 2, todaySalesTotal: 20000 });
    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: {
        reservationDate: today,
        status: { in: ["confirmed", "completed"] },
        storeId: 1,
      },
    });
  });

  it("omits the store filter when storeId is null for an unrestricted (hq) admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "hq" } } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);

    await getDashboardSummary(null, today);

    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: {
        reservationDate: today,
        status: { in: ["confirmed", "completed"] },
      },
    });
  });

  it("filters to the restricted admin's own store ids when storeId is null", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(prisma.adminStore.findMany).mockResolvedValue([
      { storeId: 2 },
      { storeId: 5 },
    ] as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);

    await getDashboardSummary(null, today);

    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: {
        reservationDate: today,
        status: { in: ["confirmed", "completed"] },
        storeId: { in: [2, 5] },
      },
    });
  });

  it("ignores an out-of-scope storeId argument and falls back to the admin's own scope", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(prisma.adminStore.findMany).mockResolvedValue([
      { storeId: 2 },
      { storeId: 5 },
    ] as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);

    // 店舗9はこの管理者のスコープ外なので、クライアントから渡されても無視される。
    await getDashboardSummary(9, today);

    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: {
        reservationDate: today,
        status: { in: ["confirmed", "completed"] },
        storeId: { in: [2, 5] },
      },
    });
  });

  it("honors an in-scope storeId argument for a restricted admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(prisma.adminStore.findMany).mockResolvedValue([
      { storeId: 2 },
      { storeId: 5 },
    ] as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);

    await getDashboardSummary(5, today);

    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: {
        reservationDate: today,
        status: { in: ["confirmed", "completed"] },
        storeId: 5,
      },
    });
  });
});
