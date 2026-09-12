"use server";

import { prisma } from "@/lib/db";

export interface ReservationHistoryItem {
  id: number;
  date: string;
  storeName: string;
  categoryName: string;
  courseName: string;
  staffName: string | null;
  totalPrice: number;
  status: string;
  nominated: boolean;
}

export interface CustomerDetail {
  id: number;
  name: string;
  nameKana: string | null;
  email: string;
  phone: string;
  birthMonth: number;
  gender: string;
  lineLinked: boolean;
  statusName: string;
  statusColor: string;
  visitCount: number;
  totalSpent: number;
  reservationHistory: ReservationHistoryItem[];
}

export async function getCustomerDetail(memberId: number): Promise<CustomerDetail | null> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      status: true,
      reservations: {
        where: { status: { in: ["completed", "confirmed"] } },
        orderBy: { reservationDate: "desc" },
        include: {
          store: true,
          staff: true,
          items: { include: { course: { include: { category: true } } } },
        },
      },
    },
  });

  if (!member) return null;

  return {
    id: member.id,
    name: member.name,
    nameKana: member.nameKana,
    email: member.email,
    phone: member.phone,
    birthMonth: member.birthMonth,
    gender: member.gender,
    lineLinked: member.lineUserId !== null,
    statusName: member.status.name,
    statusColor: member.status.colorCode,
    visitCount: member.visitCount,
    totalSpent: member.totalSpent,
    reservationHistory: member.reservations.map((r) => ({
      id: r.id,
      date: r.reservationDate.toISOString().slice(0, 10),
      storeName: r.store.name,
      categoryName: r.items.find((i) => i.itemType === "course")?.course?.category?.name ?? "",
      courseName: r.items.find((i) => i.itemType === "course")?.course?.name ?? "",
      staffName: r.staff?.name ?? null,
      totalPrice: r.totalPrice,
      status: r.status,
      nominated: r.nominationFeeApplied > 0,
    })),
  };
}
