import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDashboardSummary } from "./dashboard-summary";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findMany: vi.fn() },
  },
}));

const today = new Date("2026-09-15T00:00:00Z");

describe("getDashboardSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts today's confirmed/completed reservations and sums their price", async () => {
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

  it("omits the store filter when storeId is null (all stores)", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);

    await getDashboardSummary(null, today);

    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: {
        reservationDate: today,
        status: { in: ["confirmed", "completed"] },
      },
    });
  });

  it("filters to allowedStoreIds when storeId is null but allowedStoreIds is given", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);

    await getDashboardSummary(null, today, [2, 5]);

    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: {
        reservationDate: today,
        status: { in: ["confirmed", "completed"] },
        storeId: { in: [2, 5] },
      },
    });
  });
});
