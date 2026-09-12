"use server";

import { prisma } from "@/lib/db";
import { dbTimeToMinutes } from "@/lib/reservation/time";
import { isSlotFree } from "@/lib/reservation/slot-conflict";

export type AssignReservationStaffResult =
  | { status: "assigned" }
  | { status: "not_found" }
  | { status: "already_assigned" }
  | { status: "different_store" }
  | { status: "conflict" };

/**
 * 予約カレンダー上で「指名なし」のカードをスタッフの列にドラッグ＆ドロップ
 * した際に呼ばれる。すでに担当が付いている予約の付け替えはスコープ外
 * （そちらはUIからそもそもドラッグできない前提）。
 */
export async function assignReservationStaff(
  reservationId: number,
  staffId: number,
): Promise<AssignReservationStaffResult> {
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!reservation) {
    return { status: "not_found" };
  }
  if (reservation.staffId !== null) {
    return { status: "already_assigned" };
  }

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff) {
    return { status: "not_found" };
  }
  if (staff.storeId !== reservation.storeId) {
    return { status: "different_store" };
  }

  const startMinutes = dbTimeToMinutes(reservation.startTime);
  const endMinutes = dbTimeToMinutes(reservation.endTime);

  const existing = await prisma.reservation.findMany({
    where: {
      staffId,
      reservationDate: reservation.reservationDate,
      status: { in: ["temp_hold", "confirmed"] },
      id: { not: reservationId },
    },
  });
  const isFree = isSlotFree(
    startMinutes,
    endMinutes,
    existing.map((r) => ({
      startMinutes: dbTimeToMinutes(r.startTime),
      endMinutes: dbTimeToMinutes(r.endTime),
    })),
  );
  if (!isFree) {
    return { status: "conflict" };
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      staffId,
      nominationFeeApplied: staff.nominationFee,
      // 割り当て前はnominationFeeApplied=0（指名なし）のはずなので、
      // 差分ではなくスタッフの指名料をそのまま加算すればよい。
      totalPrice: reservation.totalPrice + staff.nominationFee,
    },
  });

  return { status: "assigned" };
}
