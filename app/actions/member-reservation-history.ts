"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export interface MemberReservationHistoryItem {
  id: number;
  date: string;
  storeName: string;
  courseName: string;
  staffName: string | null;
  totalPrice: number;
  status: string;
}

export async function getMemberReservationHistory(): Promise<
  MemberReservationHistoryItem[] | null
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return null;
  }
  const memberId = Number(session.user.id);

  const reservations = await prisma.reservation.findMany({
    where: { memberId, status: { in: ["completed", "confirmed", "cancelled", "no_show"] } },
    orderBy: { reservationDate: "desc" },
    include: { store: true, staff: true, items: { include: { course: true } } },
  });

  return reservations.map((r) => ({
    id: r.id,
    date: r.reservationDate.toISOString().slice(0, 10),
    storeName: r.store.name,
    courseName: r.items.find((i) => i.itemType === "course")?.course?.name ?? "",
    staffName: r.staff?.name ?? null,
    totalPrice: r.totalPrice,
    status: r.status,
  }));
}
