"use server";

import { prisma } from "@/lib/db";

export interface CustomerListItem {
  id: number;
  name: string;
  statusName: string;
  statusColor: string;
  visitCount: number;
  totalSpent: number;
  lastVisitDate: string | null;
  primaryStoreName: string | null;
  createdAt: string;
}

export interface CustomerSearchParams {
  name?: string;
  phone?: string;
  statusId?: number;
  storeId?: number;
}

export async function searchCustomers(
  params: CustomerSearchParams,
): Promise<CustomerListItem[]> {
  const members = await prisma.member.findMany({
    where: {
      ...(params.name ? { name: { contains: params.name, mode: "insensitive" } } : {}),
      ...(params.phone ? { phone: { contains: params.phone } } : {}),
      ...(params.statusId ? { statusId: params.statusId } : {}),
      ...(params.storeId ? { primaryStoreId: params.storeId } : {}),
    },
    include: {
      status: true,
      primaryStore: true,
      reservations: {
        where: { status: "completed" },
        orderBy: { reservationDate: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return members.map((m) => ({
    id: m.id,
    name: m.name,
    statusName: m.status.name,
    statusColor: m.status.colorCode,
    visitCount: m.visitCount,
    totalSpent: m.totalSpent,
    lastVisitDate: m.reservations[0]?.reservationDate.toISOString().slice(0, 10) ?? null,
    primaryStoreName: m.primaryStore?.name ?? null,
    createdAt: m.createdAt.toISOString().slice(0, 10),
  }));
}
