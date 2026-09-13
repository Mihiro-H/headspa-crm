"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dbTimeToMinutes, minutesToLabel } from "@/lib/reservation/time";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

export interface ShiftDraftItem {
  workDate: string;
  isDayOff: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
}

function monthRange(yearMonth: string): { start: Date; end: Date } {
  const [year, month] = yearMonth.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0)),
  };
}

function timeOrNull(minutes: number | null): Date | null {
  return minutes !== null
    ? new Date(`1970-01-01T${minutesToLabel(minutes)}:00.000Z`)
    : null;
}

async function requireManagerForStore(storeId: number): Promise<boolean> {
  const session = await auth();
  if (!session?.user || (session.user.role !== "hq" && session.user.role !== "manager")) {
    return false;
  }
  const scope = await getCurrentAdminStoreScope();
  return scope.isUnrestricted || scope.storeIds.includes(storeId);
}

export type ListShiftDraftsForStoreResult =
  | { status: "ok"; draftsByStaffId: Record<number, ShiftDraftItem[]> }
  | { status: "unauthorized" };

export async function listShiftDraftsForStore(
  storeId: number,
  yearMonth: string,
): Promise<ListShiftDraftsForStoreResult> {
  if (!(await requireManagerForStore(storeId))) {
    return { status: "unauthorized" };
  }

  const staffList = await prisma.staff.findMany({ where: { storeId, isActive: true } });
  const { start, end } = monthRange(yearMonth);
  const drafts = await prisma.staffShiftDraft.findMany({
    where: { staffId: { in: staffList.map((s) => s.id) }, workDate: { gte: start, lte: end } },
    orderBy: { workDate: "asc" },
  });

  const draftsByStaffId: Record<number, ShiftDraftItem[]> = {};
  for (const d of drafts) {
    draftsByStaffId[d.staffId] = draftsByStaffId[d.staffId] ?? [];
    draftsByStaffId[d.staffId].push({
      workDate: d.workDate.toISOString().slice(0, 10),
      isDayOff: d.isDayOff,
      startMinutes: d.startTime ? dbTimeToMinutes(d.startTime) : null,
      endMinutes: d.endTime ? dbTimeToMinutes(d.endTime) : null,
    });
  }

  return { status: "ok", draftsByStaffId };
}

export interface UpdateShiftDraftParams {
  staffId: number;
  workDate: string;
  isDayOff: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
}

export type UpdateShiftDraftResult = { status: "updated" } | { status: "unauthorized" };

export async function updateShiftDraft(
  params: UpdateShiftDraftParams,
): Promise<UpdateShiftDraftResult> {
  const session = await auth();
  if (!session?.user || (session.user.role !== "hq" && session.user.role !== "manager")) {
    return { status: "unauthorized" };
  }

  const staff = await prisma.staff.findUnique({ where: { id: params.staffId } });
  if (!staff) {
    return { status: "unauthorized" };
  }
  const scope = await getCurrentAdminStoreScope();
  if (!scope.isUnrestricted && !scope.storeIds.includes(staff.storeId)) {
    return { status: "unauthorized" };
  }

  const workDate = new Date(`${params.workDate}T00:00:00.000Z`);
  const data = {
    isDayOff: params.isDayOff,
    startTime: timeOrNull(params.startMinutes),
    endTime: timeOrNull(params.endMinutes),
  };

  await prisma.staffShiftDraft.upsert({
    where: { staffId_workDate: { staffId: params.staffId, workDate } },
    create: { staffId: params.staffId, workDate, ...data },
    update: data,
  });

  return { status: "updated" };
}

export type ConfirmShiftDraftForStoreResult =
  | { status: "confirmed"; count: number }
  | { status: "unauthorized" };

export async function confirmShiftDraftForStore(
  storeId: number,
  yearMonth: string,
): Promise<ConfirmShiftDraftForStoreResult> {
  if (!(await requireManagerForStore(storeId))) {
    return { status: "unauthorized" };
  }

  const staffList = await prisma.staff.findMany({ where: { storeId, isActive: true } });
  const { start, end } = monthRange(yearMonth);
  const drafts = await prisma.staffShiftDraft.findMany({
    where: { staffId: { in: staffList.map((s) => s.id) }, workDate: { gte: start, lte: end } },
  });

  const upsertOps = [];
  for (const d of drafts) {
    const data = { isDayOff: d.isDayOff, startTime: d.startTime, endTime: d.endTime };
    upsertOps.push(
      prisma.staffShift.upsert({
        where: { staffId_workDate: { staffId: d.staffId, workDate: d.workDate } },
        create: { staffId: d.staffId, workDate: d.workDate, ...data },
        update: data,
      }),
    );
  }

  // $transactionでまとめて実行することで、途中で1件失敗した場合に一部の日だけ
  // 確定された中途半端な状態が残ることを防ぐ(全件成功 or 全件ロールバック)。
  await prisma.$transaction(upsertOps);

  return { status: "confirmed", count: upsertOps.length };
}
