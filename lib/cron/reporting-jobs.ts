import { prisma } from "@/lib/db";
import { runCronJob } from "./run-job";
import { getSalesReport } from "@/app/actions/sales-report";

export interface StatusCondition {
  minVisitCount: number;
  minTotalSpent: number;
  conditionMode: "or" | "and";
}

export interface MemberActivity {
  visitCount: number;
  totalSpent: number;
}

// ORなら回数・金額いずれかを満たせば昇格対象、ANDなら両方を満たす必要がある。
export function statusQualifies(status: StatusCondition, member: MemberActivity): boolean {
  const visitOk = member.visitCount >= status.minVisitCount;
  const spentOk = member.totalSpent >= status.minTotalSpent;

  if (status.conditionMode === "and") {
    // ANDでは閾値0（未設定）の条件は member.xxx >= 0 で常に満たされるため、
    // 実質的にもう一方の条件だけで判定される（意図した挙動なので特別扱い不要）。
    return visitOk && spentOk;
  }

  // ORで閾値0（未設定）の条件をそのまま使うと、その条件だけで常にtrueになり
  // もう一方の条件を無視してしまう。閾値が実際に設定されている（0より大きい）
  // 条件のみをOR判定の対象にし、両方とも未設定なら無条件クリアの基本ステータスとして扱う。
  const visitApplies = status.minVisitCount > 0;
  const spentApplies = status.minTotalSpent > 0;
  if (!visitApplies && !spentApplies) return true;
  return (visitApplies && visitOk) || (spentApplies && spentOk);
}

export async function runStatusUpdateJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "status_update",
    async () => {
      const statuses = await prisma.customerStatus.findMany({
        orderBy: { sortOrder: "asc" },
      });
      const members = await prisma.member.findMany();

      let count = 0;
      for (const member of members) {
        const qualifying = statuses.filter((s) => statusQualifies(s, member));
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
