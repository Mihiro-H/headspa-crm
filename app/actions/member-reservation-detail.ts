"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { minutesToLabel, dbTimeToMinutes } from "@/lib/reservation/time";

export interface MemberReservationDetail {
  id: number;
  reservationDate: string;
  startTimeLabel: string;
  endTimeLabel: string;
  storeName: string;
  storePhone: string;
  courseName: string;
  optionNames: string[];
  staffName: string | null;
  totalPrice: number;
  canModify: boolean;
}

export async function getMemberNextReservation(
  today: Date = new Date(),
): Promise<MemberReservationDetail | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return null;
  }
  const memberId = Number(session.user.id);

  const reservation = await prisma.reservation.findFirst({
    where: { memberId, status: "confirmed", reservationDate: { gte: today } },
    orderBy: { reservationDate: "asc" },
    include: {
      store: true,
      staff: true,
      items: { include: { course: true, option: true } },
    },
  });

  if (!reservation) return null;

  const courseItem = reservation.items.find((i) => i.itemType === "course");
  const optionItems = reservation.items.filter((i) => i.itemType === "option");

  return {
    id: reservation.id,
    reservationDate: reservation.reservationDate.toISOString().slice(0, 10),
    startTimeLabel: minutesToLabel(dbTimeToMinutes(reservation.startTime)),
    endTimeLabel: minutesToLabel(dbTimeToMinutes(reservation.endTime)),
    storeName: reservation.store.name,
    storePhone: reservation.store.phone,
    courseName: courseItem?.course?.name ?? "",
    optionNames: optionItems.map((i) => i.option?.name ?? "").filter(Boolean),
    staffName: reservation.staff?.name ?? null,
    totalPrice: reservation.totalPrice,
    canModify: today < reservation.cancellationDeadline,
  };
}

export type CancelMemberReservationResult =
  | { status: "cancelled" }
  | { status: "unauthorized" }
  | { status: "not_found" }
  | { status: "deadline_passed" };

export async function cancelMemberReservation(
  params: { reservationId: number },
  today: Date = new Date(),
): Promise<CancelMemberReservationResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return { status: "unauthorized" };
  }
  const memberId = Number(session.user.id);

  const reservation = await prisma.reservation.findUnique({
    where: { id: params.reservationId },
  });

  if (!reservation || reservation.memberId !== memberId) {
    return { status: "unauthorized" };
  }
  if (reservation.status !== "confirmed") {
    return { status: "not_found" };
  }
  if (today >= reservation.cancellationDeadline) {
    return { status: "deadline_passed" };
  }

  await prisma.reservation.update({
    where: { id: params.reservationId },
    data: { status: "cancelled" },
  });

  return { status: "cancelled" };
}
