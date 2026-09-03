"use server";

import { prisma } from "@/lib/db";

export interface CustomerStatusItem {
  id: number;
  name: string;
  minVisitCount: number;
  colorCode: string;
  sortOrder: number;
}

export async function listCustomerStatuses(): Promise<CustomerStatusItem[]> {
  const statuses = await prisma.customerStatus.findMany({ orderBy: { sortOrder: "asc" } });
  return statuses.map((s) => ({
    id: s.id,
    name: s.name,
    minVisitCount: s.minVisitCount,
    colorCode: s.colorCode,
    sortOrder: s.sortOrder,
  }));
}

export interface UpdateStatusThresholdParams {
  statusId: number;
  minVisitCount: number;
}

export async function updateStatusThreshold(
  params: UpdateStatusThresholdParams,
): Promise<void> {
  await prisma.customerStatus.update({
    where: { id: params.statusId },
    data: { minVisitCount: params.minVisitCount },
  });
}
