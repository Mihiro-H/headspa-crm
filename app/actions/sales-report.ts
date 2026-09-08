"use server";

import { prisma } from "@/lib/db";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

const REVENUE_STATUSES = ["confirmed", "completed"] as const;

export interface SalesReportSummary {
  salesTotal: number;
  customerCount: number;
  averageSpend: number;
  newCustomerCount: number;
  repeatCustomerCount: number;
  nominationSalesRatio: number;
}

export interface DailySalesPoint {
  date: string;
  total: number;
}

export interface CourseSalesSlice {
  courseName: string;
  total: number;
}

export interface StaffSalesBar {
  staffName: string;
  total: number;
}

export interface SalesReportDetailRow {
  id: number;
  date: string;
  storeName: string;
  memberName: string;
  courseName: string;
  staffName: string | null;
  totalPrice: number;
}

export interface SalesReport {
  summary: SalesReportSummary;
  dailySales: DailySalesPoint[];
  courseSales: CourseSalesSlice[];
  staffSales: StaffSalesBar[];
  details: SalesReportDetailRow[];
}

export interface GetSalesReportParams {
  startDate: string;
  endDate: string;
  storeId: number | null;
}

interface BuildSalesReportParams extends GetSalesReportParams {
  allowedStoreIds?: number[];
}

// 内部専用のレポート構築処理。allowedStoreIds はクライアントから直接渡させず、
// getSalesReportForCurrentAdmin がサーバー側で解決したスコープからのみ渡す
// （このヘルパーは非exportのためサーバーアクションとして外部から直接呼び出せない）。
async function buildSalesReport(params: BuildSalesReportParams): Promise<SalesReport> {
  const start = new Date(`${params.startDate}T00:00:00.000Z`);
  const end = new Date(`${params.endDate}T00:00:00.000Z`);

  const reservations = await prisma.reservation.findMany({
    where: {
      reservationDate: { gte: start, lte: end },
      status: { in: [...REVENUE_STATUSES] },
      ...(params.storeId
        ? { storeId: params.storeId }
        : params.allowedStoreIds
          ? { storeId: { in: params.allowedStoreIds } }
          : {}),
    },
    include: {
      store: true,
      member: true,
      staff: true,
      items: { include: { course: true } },
    },
    orderBy: { reservationDate: "asc" },
  });

  const salesTotal = reservations.reduce((sum, r) => sum + r.totalPrice, 0);
  const customerCount = reservations.length;
  const averageSpend = customerCount > 0 ? Math.round(salesTotal / customerCount) : 0;

  const nominatedTotal = reservations
    .filter((r) => r.staffId !== null)
    .reduce((sum, r) => sum + r.totalPrice, 0);
  const nominationSalesRatio = salesTotal > 0 ? Math.round((nominatedTotal / salesTotal) * 100) : 0;

  const memberIds = [
    ...new Set(reservations.map((r) => r.memberId).filter((id): id is number => id !== null)),
  ];
  const earliestReservations = await prisma.reservation.findMany({
    where: { memberId: { in: memberIds }, status: { in: [...REVENUE_STATUSES] } },
    orderBy: { reservationDate: "asc" },
    select: { memberId: true, reservationDate: true },
  });
  const earliestDateByMemberId = new Map<number, Date>();
  for (const r of earliestReservations) {
    if (r.memberId !== null && !earliestDateByMemberId.has(r.memberId)) {
      earliestDateByMemberId.set(r.memberId, r.reservationDate);
    }
  }
  const newCustomerCount = memberIds.filter((id) => {
    const earliest = earliestDateByMemberId.get(id);
    return earliest !== undefined && earliest >= start;
  }).length;
  const repeatCustomerCount = memberIds.length - newCustomerCount;

  const dailyMap = new Map<string, number>();
  for (const r of reservations) {
    const dateKey = r.reservationDate.toISOString().slice(0, 10);
    dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + r.totalPrice);
  }
  const dailySales = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));

  const courseMap = new Map<string, number>();
  for (const r of reservations) {
    for (const item of r.items) {
      if (item.itemType === "course" && item.course) {
        courseMap.set(
          item.course.name,
          (courseMap.get(item.course.name) ?? 0) + item.priceAtBooking,
        );
      }
    }
  }
  const courseSales = [...courseMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([courseName, total]) => ({ courseName, total }));

  const staffMap = new Map<string, number>();
  for (const r of reservations) {
    const staffName = r.staff?.name ?? "指名なし";
    staffMap.set(staffName, (staffMap.get(staffName) ?? 0) + r.totalPrice);
  }
  const staffSales = [...staffMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([staffName, total]) => ({ staffName, total }));

  const details = reservations.map((r) => ({
    id: r.id,
    date: r.reservationDate.toISOString().slice(0, 10),
    storeName: r.store.name,
    memberName: r.member?.name ?? "",
    courseName: r.items.find((i) => i.itemType === "course")?.course?.name ?? "",
    staffName: r.staff?.name ?? null,
    totalPrice: r.totalPrice,
  }));

  return {
    summary: {
      salesTotal,
      customerCount,
      averageSpend,
      newCustomerCount,
      repeatCustomerCount,
      nominationSalesRatio,
    },
    dailySales,
    courseSales,
    staffSales,
    details,
  };
}

// cron等の信頼済みサーバーサイド呼び出し専用。パラメータをそのまま信頼するため、
// クライアントから直接呼び出させてはいけない（管理画面からは
// getSalesReportForCurrentAdmin を使うこと）。
export async function getSalesReport(params: GetSalesReportParams): Promise<SalesReport> {
  return buildSalesReport(params);
}

// 管理画面向け。呼び出し元の店舗スコープをサーバー側で解決し、
// クライアントから渡された storeId がスコープ外なら無視する。
export async function getSalesReportForCurrentAdmin(
  params: GetSalesReportParams,
): Promise<SalesReport> {
  const scope = await getCurrentAdminStoreScope();

  const effectiveStoreId =
    params.storeId && (scope.isUnrestricted || scope.storeIds.includes(params.storeId))
      ? params.storeId
      : null;

  return buildSalesReport({
    ...params,
    storeId: effectiveStoreId,
    allowedStoreIds: scope.isUnrestricted ? undefined : scope.storeIds,
  });
}
