import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCronJob } from "./run-job";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    cronJobLog: { create: vi.fn() },
  },
}));

describe("runCronJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs success with the task's target count", async () => {
    const now = new Date("2026-09-05T02:00:00.000Z");
    const task = vi.fn().mockResolvedValue({ targetCount: 5 });

    await runCronJob("test_job", task, now);

    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "test_job", executedAt: now, status: "success", targetCount: 5 },
    });
  });

  it("logs failure with the error message when the task throws", async () => {
    const now = new Date("2026-09-05T02:00:00.000Z");
    const task = vi.fn().mockRejectedValue(new Error("db down"));

    await runCronJob("test_job", task, now);

    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: {
        jobName: "test_job",
        executedAt: now,
        status: "failed",
        targetCount: 0,
        errorMessage: "db down",
      },
    });
  });

  it("logs a generic error message when a non-Error value is thrown", async () => {
    const now = new Date("2026-09-05T02:00:00.000Z");
    const task = vi.fn().mockRejectedValue("string failure");

    await runCronJob("test_job", task, now);

    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: {
        jobName: "test_job",
        executedAt: now,
        status: "failed",
        targetCount: 0,
        errorMessage: "unknown error",
      },
    });
  });
});
