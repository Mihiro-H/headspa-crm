"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export interface AdminStoreScope {
  isUnrestricted: boolean; // hqロールならtrue（常に全店舗）
  storeIds: number[];
}

export async function getCurrentAdminStoreScope(): Promise<AdminStoreScope> {
  const session = await auth();
  if (!session?.user) {
    return { isUnrestricted: true, storeIds: [] };
  }
  if (session.user.role === "hq") {
    return { isUnrestricted: true, storeIds: [] };
  }

  const adminId = Number(session.user.id);
  const stores = await prisma.adminStore.findMany({ where: { adminId } });
  return { isUnrestricted: false, storeIds: stores.map((s) => s.storeId) };
}
