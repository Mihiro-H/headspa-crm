"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isTempHoldExpired } from "@/lib/reservation/temp-hold";
import { createNotification } from "@/lib/notifications/create-notification";
import { addUsedStore } from "@/lib/customer/add-used-store";
import { minutesToLabel, dbTimeToMinutes } from "@/lib/reservation/time";

export interface ConfirmReservationParams {
  reservationId: number;
}

export type ConfirmReservationResult =
  | { status: "confirmed" }
  | { status: "expired" }
  | { status: "not_found" }
  | { status: "unauthorized" };

export async function confirmReservation(
  params: ConfirmReservationParams,
): Promise<ConfirmReservationResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return { status: "unauthorized" };
  }
  const memberId = Number(session.user.id);

  const reservation = await prisma.reservation.findUnique({
    where: { id: params.reservationId },
  });

  if (!reservation || reservation.status !== "temp_hold") {
    return { status: "not_found" };
  }

  if (
    reservation.tempHoldExpiresAt &&
    isTempHoldExpired(reservation.tempHoldExpiresAt, new Date())
  ) {
    return { status: "expired" };
  }

  const updated = await prisma.reservation.update({
    where: { id: params.reservationId },
    data: { memberId, status: "confirmed", tempHoldExpiresAt: null },
  });

  await createNotification({
    storeId: updated.storeId,
    type: "new_reservation",
    message: `新規WEB予約：${updated.reservationDate.toISOString().slice(0, 10)} ${minutesToLabel(dbTimeToMinutes(updated.startTime))}〜`,
    reservationId: updated.id,
  });

  await addUsedStore(memberId, updated.storeId);

  return { status: "confirmed" };
}
