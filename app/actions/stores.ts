"use server";

import { prisma } from "@/lib/db";

export interface StoreListItem {
  id: number;
  name: string;
  address: string | null;
  phone: string;
  nearestStation: string | null;
}

export async function listStores(): Promise<StoreListItem[]> {
  const stores = await prisma.store.findMany({ orderBy: { id: "asc" } });
  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    phone: s.phone,
    nearestStation: s.nearestStation,
  }));
}
