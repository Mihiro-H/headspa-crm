"use server";

import { prisma } from "@/lib/db";
import { generateAvailableSlots } from "@/lib/reservation/time-slots";
import { dbTimeToMinutes } from "@/lib/reservation/time";
import { isWithinBookingWindow } from "@/lib/reservation/booking-window";

export interface GetAvailableSlotsParams {
  storeId: number;
  staffId: number | null;
  date: string;
  courseId: number;
  optionIds: number[];
}

export async function getAvailableSlots(
  params: GetAvailableSlotsParams,
  today: Date = new Date(),
): Promise<number[]> {
  const targetDate = new Date(`${params.date}T00:00:00.000Z`);

  if (!isWithinBookingWindow(targetDate, today)) {
    return [];
  }

  const [store, holidays, course, options, staffShift, existingReservations] = await Promise.all([
    prisma.store.findUniqueOrThrow({ where: { id: params.storeId } }),
    prisma.storeHoliday.findMany({ where: { storeId: params.storeId } }),
    prisma.course.findUniqueOrThrow({
      where: { id: params.courseId },
      include: { category: true },
    }),
    prisma.option.findMany({ where: { id: { in: params.optionIds } } }),
    params.staffId
      ? prisma.staffShift.findUnique({
          where: { staffId_workDate: { staffId: params.staffId, workDate: targetDate } },
        })
      : Promise.resolve(null),
    prisma.reservation.findMany({
      where: {
        storeId: params.storeId,
        reservationDate: targetDate,
        status: { in: ["temp_hold", "confirmed"] },
        ...(params.staffId ? { staffId: params.staffId } : {}),
      },
    }),
  ]);

  const totalDuration =
    course.treatmentTimeMin + options.reduce((sum, o) => sum + o.durationMin, 0);

  return generateAvailableSlots({
    store,
    date: targetDate,
    holidayDates: holidays.map((h) => h.holidayDate),
    totalDurationMinutes: totalDuration,
    isLuxuryCategory: course.category.name === "ラグジュアリー",
    slotIntervalMinutes: 30,
    staffShift: staffShift ?? undefined,
    existingBookings: existingReservations.map((r) => ({
      startMinutes: dbTimeToMinutes(r.startTime),
      endMinutes: dbTimeToMinutes(r.endTime),
    })),
  });
}
