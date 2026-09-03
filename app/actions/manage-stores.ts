"use server";

import { prisma } from "@/lib/db";

export interface ManagedStore {
  id: number;
  name: string;
  address: string | null;
  phone: string;
  nearestStation: string | null;
}

export async function listAllStoresForManagement(): Promise<ManagedStore[]> {
  const stores = await prisma.store.findMany({ orderBy: { id: "asc" } });
  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    phone: s.phone,
    nearestStation: s.nearestStation,
  }));
}

export interface UpdateStoreDetailsParams {
  storeId: number;
  address: string;
  phone: string;
}

export async function updateStoreDetails(params: UpdateStoreDetailsParams): Promise<void> {
  await prisma.store.update({
    where: { id: params.storeId },
    data: { address: params.address, phone: params.phone },
  });
}
