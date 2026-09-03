import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCronJobLogs } from "./cron-logs";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    cronJobLog: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("listCronJobLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(listCronJobLogs()).rejects.toThrow("unauthorized");
    expect(prisma.cronJobLog.findMany).not.toHaveBeenCalled();
  });

  it("returns logs ordered by newest execution first", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.cronJobLog.findMany).mockResolvedValue([
      {
        id: 1,
        jobName: "temp_hold_release",
        executedAt: new Date("2026-09-05T18:01:00.000Z"),
        status: "success",
        targetCount: 3,
        errorMessage: null,
      },
    ] as never);

    const result = await listCronJobLogs();

    expect(result).toEqual([
      {
        id: 1,
        jobName: "temp_hold_release",
        executedAt: "2026-09-05T18:01:00.000Z",
        status: "success",
        targetCount: 3,
        errorMessage: null,
      },
    ]);
    expect(prisma.cronJobLog.findMany).toHaveBeenCalledWith({
      orderBy: { executedAt: "desc" },
      take: 200,
    });
  });
});
