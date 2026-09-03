"use server";

import { prisma } from "@/lib/db";

export interface DashboardSummary {
  todayReservationCount: number;
  todaySalesTotal: number;
}

export async function getDashboardSummary(
  storeId: number | null,
  today: Date = new Date(),
): Promise<DashboardSummary> {
  const reservations = await prisma.reservation.findMany({
    where: {
      reservationDate: today,
      status: { in: ["confirmed", "completed"] },
      ...(storeId ? { storeId } : {}),
    },
  });

  return {
    todayReservationCount: reservations.length,
    todaySalesTotal: reservations.reduce((sum, r) => sum + r.totalPrice, 0),
  };
}
