"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { minutesToLabel, dbTimeToMinutes } from "@/lib/reservation/time";

export interface NextReservationSummary {
  id: number;
  reservationDate: string;
  startTimeLabel: string;
  storeName: string;
  courseName: string;
  staffName: string | null;
}

export interface MypageSummary {
  name: string;
  statusName: string;
  statusColor: string;
  visitCount: number;
  nextStatusName: string | null;
  visitsToNextStatus: number | null;
  currentStatusMinVisitCount: number;
  nextStatusMinVisitCount: number | null;
  nextReservation: NextReservationSummary | null;
}

export async function getMypageSummary(today: Date = new Date()): Promise<MypageSummary | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return null;
  }
  const memberId = Number(session.user.id);

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { status: true },
  });
  if (!member) return null;

  const statuses = await prisma.customerStatus.findMany({ orderBy: { sortOrder: "asc" } });
  const currentIndex = statuses.findIndex((s) => s.id === member.statusId);
  const nextStatus = currentIndex >= 0 ? statuses[currentIndex + 1] : undefined;

  const nextReservation = await prisma.reservation.findFirst({
    where: { memberId, status: "confirmed", reservationDate: { gte: today } },
    orderBy: { reservationDate: "asc" },
    include: { store: true, staff: true, items: { include: { course: true } } },
  });

  return {
    name: member.name,
    statusName: member.status.name,
    statusColor: member.status.colorCode,
    visitCount: member.visitCount,
    nextStatusName: nextStatus?.name ?? null,
    visitsToNextStatus: nextStatus ? nextStatus.minVisitCount - member.visitCount : null,
    currentStatusMinVisitCount: member.status.minVisitCount,
    nextStatusMinVisitCount: nextStatus?.minVisitCount ?? null,
    nextReservation: nextReservation
      ? {
          id: nextReservation.id,
          reservationDate: nextReservation.reservationDate.toISOString().slice(0, 10),
          startTimeLabel: minutesToLabel(dbTimeToMinutes(nextReservation.startTime)),
          storeName: nextReservation.store.name,
          courseName:
            nextReservation.items.find((i) => i.itemType === "course")?.course?.name ?? "",
          staffName: nextReservation.staff?.name ?? null,
        }
      : null,
  };
}
