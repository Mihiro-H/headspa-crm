"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dbTimeToMinutes, minutesToLabel, monthRange } from "@/lib/reservation/time";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

export interface StaffShiftRequestItem {
  workDate: string;
  isDayOffRequested: boolean;
  preferredStartMinutes: number | null;
  preferredEndMinutes: number | null;
}

function toItem(r: {
  workDate: Date;
  isDayOffRequested: boolean;
  preferredStartTime: Date | null;
  preferredEndTime: Date | null;
}): StaffShiftRequestItem {
  return {
    workDate: r.workDate.toISOString().slice(0, 10),
    isDayOffRequested: r.isDayOffRequested,
    preferredStartMinutes: r.preferredStartTime ? dbTimeToMinutes(r.preferredStartTime) : null,
    preferredEndMinutes: r.preferredEndTime ? dbTimeToMinutes(r.preferredEndTime) : null,
  };
}

export async function getMyStaffId(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "staff") {
    return null;
  }
  const admin = await prisma.admin.findUnique({ where: { id: Number(session.user.id) } });
  return admin?.staffId ?? null;
}

export async function getStaffShiftRequests(
  staffId: number,
  yearMonth: string,
): Promise<StaffShiftRequestItem[]> {
  const session = await auth();
  if (!session?.user) return [];

  const myStaffId = await getMyStaffId();
  if (myStaffId !== staffId) {
    const isManagerRole = session.user.role === "manager" || session.user.role === "hq";
    if (!isManagerRole) return [];

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) return [];

    const scope = await getCurrentAdminStoreScope();
    if (!scope.isUnrestricted && !scope.storeIds.includes(staff.storeId)) return [];
  }

  const { start, end } = monthRange(yearMonth);
  const requests = await prisma.staffShiftRequest.findMany({
    where: { staffId, workDate: { gte: start, lte: end } },
    orderBy: { workDate: "asc" },
  });

  return requests.map(toItem);
}

export interface SaveStaffShiftRequestParams {
  staffId: number;
  workDate: string;
  isDayOffRequested: boolean;
  preferredStartMinutes: number | null;
  preferredEndMinutes: number | null;
}

export type SaveStaffShiftRequestResult = { status: "saved" } | { status: "unauthorized" };

export async function saveStaffShiftRequest(
  params: SaveStaffShiftRequestParams,
): Promise<SaveStaffShiftRequestResult> {
  const myStaffId = await getMyStaffId();
  if (myStaffId !== params.staffId) {
    return { status: "unauthorized" };
  }

  const workDate = new Date(`${params.workDate}T00:00:00.000Z`);
  const preferredStartTime =
    params.preferredStartMinutes !== null
      ? new Date(`1970-01-01T${minutesToLabel(params.preferredStartMinutes)}:00.000Z`)
      : null;
  const preferredEndTime =
    params.preferredEndMinutes !== null
      ? new Date(`1970-01-01T${minutesToLabel(params.preferredEndMinutes)}:00.000Z`)
      : null;

  await prisma.staffShiftRequest.upsert({
    where: { staffId_workDate: { staffId: params.staffId, workDate } },
    create: {
      staffId: params.staffId,
      workDate,
      isDayOffRequested: params.isDayOffRequested,
      preferredStartTime,
      preferredEndTime,
    },
    update: {
      isDayOffRequested: params.isDayOffRequested,
      preferredStartTime,
      preferredEndTime,
    },
  });

  return { status: "saved" };
}

export type ListShiftRequestsForStoreResult =
  | { status: "ok"; requestsByStaffId: Record<number, StaffShiftRequestItem[]> }
  | { status: "unauthorized" };

export async function listShiftRequestsForStore(
  storeId: number,
  yearMonth: string,
): Promise<ListShiftRequestsForStoreResult> {
  const session = await auth();
  if (!session?.user || (session.user.role !== "hq" && session.user.role !== "manager")) {
    return { status: "unauthorized" };
  }
  const scope = await getCurrentAdminStoreScope();
  if (!scope.isUnrestricted && !scope.storeIds.includes(storeId)) {
    return { status: "unauthorized" };
  }

  const staffList = await prisma.staff.findMany({ where: { storeId, isActive: true } });
  const { start, end } = monthRange(yearMonth);
  const requests = await prisma.staffShiftRequest.findMany({
    where: { staffId: { in: staffList.map((s) => s.id) }, workDate: { gte: start, lte: end } },
    orderBy: { workDate: "asc" },
  });

  const requestsByStaffId: Record<number, StaffShiftRequestItem[]> = {};
  for (const r of requests) {
    requestsByStaffId[r.staffId] = requestsByStaffId[r.staffId] ?? [];
    requestsByStaffId[r.staffId].push(toItem(r));
  }

  return { status: "ok", requestsByStaffId };
}
