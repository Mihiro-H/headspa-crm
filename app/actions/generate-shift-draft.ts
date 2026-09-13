"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dbTimeToMinutes, monthRange, timeOrNull } from "@/lib/reservation/time";
import { getStoreOpenHours } from "@/lib/reservation/store-hours";
import { deriveDraftShift } from "@/lib/scheduling/derive-shift-draft";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

export type GenerateShiftDraftResult =
  | { status: "generated"; count: number }
  | { status: "unauthorized" };

function daysInMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function workDateFor(yearMonth: string, day: number): Date {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function requestKey(staffId: number, workDate: Date): string {
  return `${staffId}-${workDate.toISOString()}`;
}

export async function generateShiftDraftForStore(
  storeId: number,
  yearMonth: string,
): Promise<GenerateShiftDraftResult> {
  const session = await auth();
  if (!session?.user || (session.user.role !== "hq" && session.user.role !== "manager")) {
    return { status: "unauthorized" };
  }
  const scope = await getCurrentAdminStoreScope();
  if (!scope.isUnrestricted && !scope.storeIds.includes(storeId)) {
    return { status: "unauthorized" };
  }

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) {
    return { status: "unauthorized" };
  }

  const staffList = await prisma.staff.findMany({ where: { storeId, isActive: true } });
  const totalDays = daysInMonth(yearMonth);
  const { start, end } = monthRange(yearMonth);

  // 対象月の希望を一括取得し、日×スタッフごとの逐次クエリ(N+1)を避ける
  // (staff-shift-requests.tsのlistShiftRequestsForStoreと同じ一括取得パターン)。
  const requests = await prisma.staffShiftRequest.findMany({
    where: { staffId: { in: staffList.map((s) => s.id) }, workDate: { gte: start, lte: end } },
  });
  const requestByKey = new Map(requests.map((r) => [requestKey(r.staffId, r.workDate), r]));

  const upsertOps = [];
  for (const staff of staffList) {
    for (let day = 1; day <= totalDays; day++) {
      const workDate = workDateFor(yearMonth, day);
      const request = requestByKey.get(requestKey(staff.id, workDate)) ?? null;

      const storeHours = getStoreOpenHours(store, workDate);
      const draft = deriveDraftShift(
        request
          ? {
              requestType: request.requestType,
              preferredStartMinutes: request.preferredStartTime
                ? dbTimeToMinutes(request.preferredStartTime)
                : null,
              preferredEndMinutes: request.preferredEndTime
                ? dbTimeToMinutes(request.preferredEndTime)
                : null,
            }
          : null,
        storeHours,
      );

      const data = {
        isDayOff: draft.isDayOff,
        startTime: timeOrNull(draft.startMinutes),
        endTime: timeOrNull(draft.endMinutes),
      };

      upsertOps.push(
        prisma.staffShiftDraft.upsert({
          where: { staffId_workDate: { staffId: staff.id, workDate } },
          create: { staffId: staff.id, workDate, ...data },
          update: data,
        }),
      );
    }
  }

  // $transactionでまとめて実行することで、途中で1件失敗した場合に一部の日だけ
  // 更新された中途半端な状態が残ることを防ぐ(全件成功 or 全件ロールバック)。
  await prisma.$transaction(upsertOps);

  return { status: "generated", count: upsertOps.length };
}
