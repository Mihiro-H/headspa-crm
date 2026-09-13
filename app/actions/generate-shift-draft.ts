"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dbTimeToMinutes, minutesToLabel } from "@/lib/reservation/time";
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

function timeOrNull(minutes: number | null): Date | null {
  return minutes !== null
    ? new Date(`1970-01-01T${minutesToLabel(minutes)}:00.000Z`)
    : null;
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

  let count = 0;
  for (const staff of staffList) {
    for (let day = 1; day <= totalDays; day++) {
      const workDate = workDateFor(yearMonth, day);

      const request = await prisma.staffShiftRequest.findUnique({
        where: { staffId_workDate: { staffId: staff.id, workDate } },
      });

      const storeHours = getStoreOpenHours(store, workDate);
      const draft = deriveDraftShift(
        request
          ? {
              isDayOffRequested: request.isDayOffRequested,
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

      await prisma.staffShiftDraft.upsert({
        where: { staffId_workDate: { staffId: staff.id, workDate } },
        create: { staffId: staff.id, workDate, ...data },
        update: data,
      });
      count++;
    }
  }

  return { status: "generated", count };
}
