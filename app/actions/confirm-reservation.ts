"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isTempHoldExpired } from "@/lib/reservation/temp-hold";
import { createNotification } from "@/lib/notifications/create-notification";
import { addUsedStore } from "@/lib/customer/add-used-store";
import { minutesToLabel, dbTimeToMinutes } from "@/lib/reservation/time";
import { formatJapaneseDate } from "@/lib/reservation/date-format";
import { sendReservationConfirmation } from "@/lib/delivery/send-reservation-confirmation";

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
    include: { member: true, store: true },
  });

  await createNotification({
    storeId: updated.storeId,
    type: "new_reservation",
    message: `新規WEB予約：${updated.reservationDate.toISOString().slice(0, 10)} ${minutesToLabel(dbTimeToMinutes(updated.startTime))}〜`,
    reservationId: updated.id,
  });

  await addUsedStore(memberId, updated.storeId);

  // updated.memberは上のupdateで自分自身のmemberIdを設定した直後の再取得なのでnullになり得ないが、
  // memberIdが外部キーとしてnullable定義のためPrismaの型上はnullを許容する。
  if (updated.member) {
    // 会員への確認メール/LINE。管理画面（AutoDeliveryTab）で「予約完了通知」が
    // 有効化されていない場合は何も送らない（sendReservationConfirmation内で判定）。
    // 予約自体の確定は既に完了しているため、送信の成否で処理結果を変えない。
    await sendReservationConfirmation({
      member: updated.member,
      storeName: updated.store.name,
      reservationDateLabel: formatJapaneseDate(updated.reservationDate.toISOString().slice(0, 10)),
      startTimeLabel: minutesToLabel(dbTimeToMinutes(updated.startTime)),
      now: new Date(),
    });
  }

  return { status: "confirmed" };
}
