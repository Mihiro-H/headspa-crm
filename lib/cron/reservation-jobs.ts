import { prisma } from "@/lib/db";
import { runCronJob } from "./run-job";
import { releaseExpiredTempHolds } from "@/lib/reservation/release-expired-holds";

export async function runTempHoldReleaseJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "temp_hold_release",
    async () => {
      const result = await releaseExpiredTempHolds(now);
      return { targetCount: result.releasedCount };
    },
    now,
  );
}

export async function runNoShowDetectionJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "no_show_detection",
    async () => {
      const todayDateOnly = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const result = await prisma.reservation.updateMany({
        where: { status: "confirmed", reservationDate: todayDateOnly },
        data: { status: "no_show" },
      });
      return { targetCount: result.count };
    },
    now,
  );
}
