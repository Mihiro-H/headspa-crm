"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dbTimeToMinutes, monthRange } from "@/lib/reservation/time";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

export interface ConfirmedShiftRow {
  staffName: string;
  workDate: string;
  isDayOff: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
}

export type ExportConfirmedShiftsResult =
  | { status: "ok"; rows: ConfirmedShiftRow[] }
  | { status: "unauthorized" };

// 店長が「確定する」で書き込んだ本番のStaffShiftから直接読み出す（ドラフトの
// 画面状態を使い回さないので、確定後いつダウンロードしても最新の確定内容になる）。
export async function exportConfirmedShifts(
  storeId: number,
  yearMonth: string,
): Promise<ExportConfirmedShiftsResult> {
  const session = await auth();
  if (!session?.user || (session.user.role !== "hq" && session.user.role !== "manager")) {
    return { status: "unauthorized" };
  }
  const scope = await getCurrentAdminStoreScope();
  if (!scope.isUnrestricted && !scope.storeIds.includes(storeId)) {
    return { status: "unauthorized" };
  }

  const staffList = await prisma.staff.findMany({ where: { storeId, isActive: true } });
  const staffNameById = new Map(staffList.map((s) => [s.id, s.name]));

  const { start, end } = monthRange(yearMonth);
  const shifts = await prisma.staffShift.findMany({
    where: { staffId: { in: staffList.map((s) => s.id) }, workDate: { gte: start, lte: end } },
    orderBy: [{ workDate: "asc" }, { staffId: "asc" }],
  });

  const rows: ConfirmedShiftRow[] = shifts.map((sh) => ({
    staffName: staffNameById.get(sh.staffId) ?? "",
    workDate: sh.workDate.toISOString().slice(0, 10),
    isDayOff: sh.isDayOff,
    startMinutes: sh.startTime ? dbTimeToMinutes(sh.startTime) : null,
    endMinutes: sh.endTime ? dbTimeToMinutes(sh.endTime) : null,
  }));

  return { status: "ok", rows };
}
