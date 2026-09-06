"use server";

import { prisma } from "@/lib/db";
import type { StatusConditionMode } from "@prisma/client";

export interface CustomerStatusItem {
  id: number;
  name: string;
  minVisitCount: number;
  minTotalSpent: number;
  conditionMode: StatusConditionMode;
  colorCode: string;
  sortOrder: number;
}

export async function listCustomerStatuses(): Promise<CustomerStatusItem[]> {
  const statuses = await prisma.customerStatus.findMany({ orderBy: { sortOrder: "asc" } });
  return statuses.map((s) => ({
    id: s.id,
    name: s.name,
    minVisitCount: s.minVisitCount,
    minTotalSpent: s.minTotalSpent,
    conditionMode: s.conditionMode,
    colorCode: s.colorCode,
    sortOrder: s.sortOrder,
  }));
}

export interface UpdateStatusConditionParams {
  statusId: number;
  minVisitCount: number;
  minTotalSpent: number;
  conditionMode: StatusConditionMode;
}

export async function updateStatusCondition(params: UpdateStatusConditionParams): Promise<void> {
  await prisma.customerStatus.update({
    where: { id: params.statusId },
    data: {
      minVisitCount: params.minVisitCount,
      minTotalSpent: params.minTotalSpent,
      conditionMode: params.conditionMode,
    },
  });
}
