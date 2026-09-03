"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

export interface CronJobLogItem {
  id: number;
  jobName: string;
  executedAt: string;
  status: "success" | "failed";
  targetCount: number;
  errorMessage: string | null;
}

export async function listCronJobLogs(): Promise<CronJobLogItem[]> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const logs = await prisma.cronJobLog.findMany({
    orderBy: { executedAt: "desc" },
    take: 200,
  });
  return logs.map((l) => ({
    id: l.id,
    jobName: l.jobName,
    executedAt: l.executedAt.toISOString(),
    status: l.status,
    targetCount: l.targetCount,
    errorMessage: l.errorMessage,
  }));
}
