import { prisma } from "@/lib/db";

export interface CronJobResult {
  targetCount: number;
}

export async function runCronJob(
  jobName: string,
  task: () => Promise<CronJobResult>,
  now: Date = new Date(),
): Promise<void> {
  try {
    const result = await task();
    await prisma.cronJobLog.create({
      data: { jobName, executedAt: now, status: "success", targetCount: result.targetCount },
    });
  } catch (error) {
    await prisma.cronJobLog.create({
      data: {
        jobName,
        executedAt: now,
        status: "failed",
        targetCount: 0,
        errorMessage: error instanceof Error ? error.message : "unknown error",
      },
    });
  }
}
