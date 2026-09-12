"use server";

import { prisma } from "@/lib/db";
import { dbTimeToMinutes } from "@/lib/reservation/time";

export interface CalendarReservation {
  id: number;
  staffId: number | null;
  staffName: string | null;
  memberName: string | null;
  categoryName: string;
  courseName: string;
  startMinutes: number;
  endMinutes: number;
  status: string;
  source: string;
}

export async function getCalendarReservations(
  storeId: number,
  date: string,
): Promise<CalendarReservation[]> {
  const targetDate = new Date(`${date}T00:00:00.000Z`);

  const reservations = await prisma.reservation.findMany({
    where: {
      storeId,
      reservationDate: targetDate,
      status: { in: ["temp_hold", "confirmed", "completed"] },
    },
    include: {
      staff: true,
      member: true,
      items: { include: { course: { include: { category: true } } } },
    },
    orderBy: { startTime: "asc" },
  });

  return reservations.map((r) => {
    const courseItem = r.items.find((i) => i.itemType === "course");
    return {
      id: r.id,
      staffId: r.staffId,
      staffName: r.staff?.name ?? null,
      memberName: r.member?.name ?? null,
      categoryName: courseItem?.course?.category?.name ?? "",
      courseName: courseItem?.course?.name ?? "",
      startMinutes: dbTimeToMinutes(r.startTime),
      endMinutes: dbTimeToMinutes(r.endTime),
      status: r.status,
      source: r.source,
    };
  });
}
