import { describe, it, expect, vi, beforeEach } from "vitest";
import { runTempHoldReleaseJob, runNoShowDetectionJob } from "./reservation-jobs";
import { prisma } from "@/lib/db";
import { releaseExpiredTempHolds } from "@/lib/reservation/release-expired-holds";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { updateMany: vi.fn() },
    cronJobLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/reservation/release-expired-holds", () => ({
  releaseExpiredTempHolds: vi.fn(),
}));

const now = new Date("2026-09-05T23:00:00.000Z");

describe("runTempHoldReleaseJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to releaseExpiredTempHolds and logs the released count", async () => {
    vi.mocked(releaseExpiredTempHolds).mockResolvedValue({ releasedCount: 3 });
    vi.mocked(prisma.cronJobLog.create).mockResolvedValue({} as never);

    await runTempHoldReleaseJob(now);

    expect(releaseExpiredTempHolds).toHaveBeenCalledWith(now);
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "temp_hold_release", executedAt: now, status: "success", targetCount: 3 },
    });
  });
});

describe("runNoShowDetectionJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks today's still-confirmed reservations as no_show and logs the count", async () => {
    vi.mocked(prisma.reservation.updateMany).mockResolvedValue({ count: 2 } as never);
    vi.mocked(prisma.cronJobLog.create).mockResolvedValue({} as never);

    await runNoShowDetectionJob(now);

    expect(prisma.reservation.updateMany).toHaveBeenCalledWith({
      where: { status: "confirmed", reservationDate: new Date("2026-09-05T00:00:00.000Z") },
      data: { status: "no_show" },
    });
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "no_show_detection", executedAt: now, status: "success", targetCount: 2 },
    });
  });
});
