"use server";

import { prisma } from "@/lib/db";

export const CUSTOMER_PAGE_SIZE = 20;

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
  page?: number;
}

export interface CustomerSearchResult {
  items: CustomerListItem[];
  totalCount: number;
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

function mapMember(m: {
  id: number;
  name: string;
  phone: string;
  visitCount: number;
  totalSpent: number;
  isActive: boolean;
  createdAt: Date;
  status: { name: string; colorCode: string };
  primaryStore: { id: number; name: string } | null;
  reservations: { reservationDate: Date }[];
}): CustomerListItem {
  return {
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
  };
}

export async function searchCustomers(
  params: CustomerSearchParams,
): Promise<CustomerSearchResult> {
  const sortBy = params.sortBy ?? "id";
  const sortDirection = params.sortDirection ?? "desc";
  const page = params.page ?? 1;

  const where = {
    ...(params.name ? { name: { contains: params.name, mode: "insensitive" as const } } : {}),
    ...(params.phone ? { phone: { contains: params.phone } } : {}),
    ...(params.statusIds && params.statusIds.length > 0
      ? { statusId: { in: params.statusIds } }
      : {}),
    ...(params.storeId ? { primaryStoreId: params.storeId } : {}),
    ...(params.includeInactive ? {} : { isActive: true }),
  };

  const include = {
    status: true,
    primaryStore: true,
    reservations: {
      where: { status: "completed" as const },
      orderBy: { reservationDate: "desc" as const },
      take: 1,
    },
  };

  // lastVisitDateはDB上でソートできない派生値のため、この場合のみ全件取得して
  // メモリ上でソート・ページ切り出しを行う。それ以外は通常通りDB側でページングする。
  if (sortBy === "lastVisitDate") {
    const members = await prisma.member.findMany({ where, include });
    const mapped = members.map(mapMember);

    mapped.sort((a, b) => {
      if (a.lastVisitDate === b.lastVisitDate) return 0;
      if (a.lastVisitDate === null) return 1;
      if (b.lastVisitDate === null) return -1;
      return sortDirection === "asc"
        ? a.lastVisitDate.localeCompare(b.lastVisitDate)
        : b.lastVisitDate.localeCompare(a.lastVisitDate);
    });

    const totalCount = mapped.length;
    const start = (page - 1) * CUSTOMER_PAGE_SIZE;
    return { items: mapped.slice(start, start + CUSTOMER_PAGE_SIZE), totalCount };
  }

  const [members, totalCount] = await Promise.all([
    prisma.member.findMany({
      where,
      include,
      orderBy: buildMemberOrderBy(sortBy, sortDirection),
      skip: (page - 1) * CUSTOMER_PAGE_SIZE,
      take: CUSTOMER_PAGE_SIZE,
    }),
    prisma.member.count({ where }),
  ]);

  return { items: members.map(mapMember), totalCount };
}
