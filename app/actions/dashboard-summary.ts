"use server";

import { prisma } from "@/lib/db";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

export interface DashboardSummary {
  todayReservationCount: number;
  todaySalesTotal: number;
}

export async function getDashboardSummary(
  storeId: number | null,
  today: Date = new Date(),
): Promise<DashboardSummary> {
  const scope = await getCurrentAdminStoreScope();

  // 特定店舗が指定されていても、閲覧者の店舗スコープ外なら無視してスコープ内に
  // 絞り込む（クライアントから渡された値を鵜呑みにしない）。
  const effectiveStoreId =
    storeId && (scope.isUnrestricted || scope.storeIds.includes(storeId)) ? storeId : null;

  const reservations = await prisma.reservation.findMany({
    where: {
      reservationDate: today,
      status: { in: ["confirmed", "completed"] },
      ...(effectiveStoreId
        ? { storeId: effectiveStoreId }
        : !scope.isUnrestricted
          ? { storeId: { in: scope.storeIds } }
          : {}),
    },
  });

  return {
    todayReservationCount: reservations.length,
    todaySalesTotal: reservations.reduce((sum, r) => sum + r.totalPrice, 0),
  };
}
