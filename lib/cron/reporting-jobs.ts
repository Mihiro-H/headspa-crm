import { prisma } from "@/lib/db";
import { runCronJob } from "./run-job";
import { getSalesReport } from "@/app/actions/sales-report";

export async function runStatusUpdateJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "status_update",
    async () => {
      const statuses = await prisma.customerStatus.findMany({
        orderBy: { minVisitCount: "asc" },
      });
      const members = await prisma.member.findMany();

      let count = 0;
      for (const member of members) {
        const qualifying = statuses.filter((s) => s.minVisitCount <= member.visitCount);
        const best = qualifying[qualifying.length - 1];
        if (best && best.id !== member.statusId) {
          await prisma.member.update({ where: { id: member.id }, data: { statusId: best.id } });
          count++;
        }
      }
      return { targetCount: count };
    },
    now,
  );
}

export async function runMonthlyReportJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "monthly_report",
    async () => {
      const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const lastMonthEnd = new Date(firstOfThisMonth.getTime() - 1);
      const lastMonthStart = new Date(
        Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1),
      );

      const report = await getSalesReport({
        startDate: lastMonthStart.toISOString().slice(0, 10),
        endDate: lastMonthEnd.toISOString().slice(0, 10),
        storeId: null,
      });

      return { targetCount: report.summary.customerCount };
    },
    now,
  );
}
