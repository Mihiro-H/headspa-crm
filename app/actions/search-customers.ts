"use server";

import { prisma } from "@/lib/db";

export type CustomerSortField = "id" | "visitCount" | "totalSpent" | "lastVisitDate";
export type SortDirection = "asc" | "desc";

export interface CustomerListItem {
  id: number;
  name: string;
  phone: string;
  statusName: string;
  statusColor: string;
  visitCount: number;
  totalSpent: number;
  lastVisitDate: string | null;
  primaryStoreId: number | null;
  primaryStoreName: string | null;
  createdAt: string;
  isActive: boolean;
}

export interface CustomerSearchParams {
  name?: string;
  phone?: string;
  statusIds?: number[];
  storeId?: number;
  includeInactive?: boolean;
  sortBy?: CustomerSortField;
  sortDirection?: SortDirection;
}

// Prismaのorderby型は動的キー（[sortBy]: ...）だと型が合わないため、
// 分岐で明示的にリテラルキーのオブジェクトを組み立てる。
function buildMemberOrderBy(sortBy: CustomerSortField, sortDirection: SortDirection) {
  switch (sortBy) {
    case "visitCount":
      return { visitCount: sortDirection };
    case "totalSpent":
      return { totalSpent: sortDirection };
    case "lastVisitDate":
      // lastVisitDateはreservationsリレーションからの派生値のため、
      // DBクエリでは仮の順序を渡し、実際の並び替えは取得後にメモリ上で行う。
      return { id: "desc" as const };
    case "id":
    default:
      return { id: sortDirection };
  }
}

export async function searchCustomers(
  params: CustomerSearchParams,
): Promise<CustomerListItem[]> {
  const sortBy = params.sortBy ?? "id";
  const sortDirection = params.sortDirection ?? "desc";

  const members = await prisma.member.findMany({
    where: {
      ...(params.name ? { name: { contains: params.name, mode: "insensitive" } } : {}),
      ...(params.phone ? { phone: { contains: params.phone } } : {}),
      ...(params.statusIds && params.statusIds.length > 0
        ? { statusId: { in: params.statusIds } }
        : {}),
      ...(params.storeId ? { primaryStoreId: params.storeId } : {}),
      ...(params.includeInactive ? {} : { isActive: true }),
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
    orderBy: buildMemberOrderBy(sortBy, sortDirection),
  });

  const mapped: CustomerListItem[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    phone: m.phone,
    statusName: m.status.name,
    statusColor: m.status.colorCode,
    visitCount: m.visitCount,
    totalSpent: m.totalSpent,
    lastVisitDate: m.reservations[0]?.reservationDate.toISOString().slice(0, 10) ?? null,
    primaryStoreId: m.primaryStore?.id ?? null,
    primaryStoreName: m.primaryStore?.name ?? null,
    createdAt: m.createdAt.toISOString().slice(0, 10),
    isActive: m.isActive,
  }));

  if (sortBy === "lastVisitDate") {
    mapped.sort((a, b) => {
      if (a.lastVisitDate === b.lastVisitDate) return 0;
      if (a.lastVisitDate === null) return 1;
      if (b.lastVisitDate === null) return -1;
      return sortDirection === "asc"
        ? a.lastVisitDate.localeCompare(b.lastVisitDate)
        : b.lastVisitDate.localeCompare(a.lastVisitDate);
    });
  }

  return mapped;
}
