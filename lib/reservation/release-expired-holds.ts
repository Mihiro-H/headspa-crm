import { prisma } from "@/lib/db";

export interface ReleaseExpiredHoldsResult {
  releasedCount: number;
}

export async function releaseExpiredTempHolds(now: Date): Promise<ReleaseExpiredHoldsResult> {
  const result = await prisma.reservation.updateMany({
    where: {
      status: "temp_hold",
      tempHoldExpiresAt: { lt: now },
    },
    data: { status: "cancelled" },
  });

  return { releasedCount: result.count };
}
