import { describe, it, expect, vi, beforeEach } from "vitest";
import { releaseExpiredTempHolds } from "./release-expired-holds";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: {
      updateMany: vi.fn(),
    },
  },
}));

describe("releaseExpiredTempHolds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels all temp_hold reservations past their expiry", async () => {
    vi.mocked(prisma.reservation.updateMany).mockResolvedValue({ count: 3 } as never);

    const result = await releaseExpiredTempHolds(new Date("2026-09-02T10:00:00.000Z"));

    expect(result).toEqual({ releasedCount: 3 });
    expect(prisma.reservation.updateMany).toHaveBeenCalledWith({
      where: {
        status: "temp_hold",
        tempHoldExpiresAt: { lt: new Date("2026-09-02T10:00:00.000Z") },
      },
      data: { status: "cancelled" },
    });
  });
});
