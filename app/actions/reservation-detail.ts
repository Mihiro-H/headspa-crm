"use server";

import { prisma } from "@/lib/db";
import { minutesToLabel, dbTimeToMinutes } from "@/lib/reservation/time";
import { createNotification } from "@/lib/notifications/create-notification";

export interface ReservationDetail {
  id: number;
  status: string;
  source: string;
  reservationDate: string;
  startTimeLabel: string;
  endTimeLabel: string;
  totalPrice: number;
  memberId: number | null;
  memberName: string | null;
  memberPhone: string | null;
  storeName: string;
  staffName: string | null;
  categoryName: string;
  courseName: string;
  optionNames: string[];
}

export async function getReservationDetail(
  reservationId: number,
): Promise<ReservationDetail | null> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      member: true,
      store: true,
      staff: true,
      items: { include: { course: { include: { category: true } }, option: true } },
    },
  });

  if (!reservation) return null;

  const courseItem = reservation.items.find((i) => i.itemType === "course");
  const optionItems = reservation.items.filter((i) => i.itemType === "option");

  return {
    id: reservation.id,
    status: reservation.status,
    source: reservation.source,
    reservationDate: reservation.reservationDate.toISOString().slice(0, 10),
    startTimeLabel: minutesToLabel(dbTimeToMinutes(reservation.startTime)),
    endTimeLabel: minutesToLabel(dbTimeToMinutes(reservation.endTime)),
    totalPrice: reservation.totalPrice,
    memberId: reservation.member?.id ?? null,
    memberName: reservation.member?.name ?? null,
    memberPhone: reservation.member?.phone ?? null,
    storeName: reservation.store.name,
    staffName: reservation.staff?.name ?? null,
    categoryName: courseItem?.course?.category?.name ?? "",
    courseName: courseItem?.course?.name ?? "",
    optionNames: optionItems.map((i) => i.option?.name ?? "").filter(Boolean),
  };
}

export async function cancelReservation(reservationId: number): Promise<void> {
  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "cancelled" },
  });

  await createNotification({
    storeId: updated.storeId,
    type: "cancellation",
    message: `予約キャンセル：${updated.reservationDate.toISOString().slice(0, 10)} ${minutesToLabel(dbTimeToMinutes(updated.startTime))}〜`,
    reservationId: updated.id,
  });
}

export async function markNoShow(reservationId: number): Promise<void> {
  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "no_show" },
  });
}
