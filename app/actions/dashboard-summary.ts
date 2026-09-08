"use server";

import { prisma } from "@/lib/db";

export interface DashboardSummary {
  todayReservationCount: number;
  todaySalesTotal: number;
}

export async function getDashboardSummary(
  storeId: number | null,
  today: Date = new Date(),
  allowedStoreIds?: number[],
): Promise<DashboardSummary> {
  const reservations = await prisma.reservation.findMany({
    where: {
      reservationDate: today,
      status: { in: ["confirmed", "completed"] },
      ...(storeId ? { storeId } : allowedStoreIds ? { storeId: { in: allowedStoreIds } } : {}),
    },
  });

  return {
    todayReservationCount: reservations.length,
    todaySalesTotal: reservations.reduce((sum, r) => sum + r.totalPrice, 0),
  };
}
