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

export interface CreateStoreParams {
  name: string;
  address: string | null;
  phone: string;
  nearestStation: string | null;
  weekdayOpen: string;
  weekdayClose: string;
  weekendOpen: string;
  weekendClose: string;
  luxuryLastOrderWeekday: string;
  luxuryLastOrderWeekend: string;
}

// 営業時間はPrisma上で日付なしの@db.Time()型のため、1970-01-01を基準日として扱う。
function toTimeDate(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00Z`);
}

export async function createStore(params: CreateStoreParams): Promise<{ storeId: number }> {
  const store = await prisma.store.create({
    data: {
      name: params.name,
      address: params.address,
      phone: params.phone,
      nearestStation: params.nearestStation,
      weekdayOpen: toTimeDate(params.weekdayOpen),
      weekdayClose: toTimeDate(params.weekdayClose),
      weekendOpen: toTimeDate(params.weekendOpen),
      weekendClose: toTimeDate(params.weekendClose),
      luxuryLastOrderWeekday: toTimeDate(params.luxuryLastOrderWeekday),
      luxuryLastOrderWeekend: toTimeDate(params.luxuryLastOrderWeekend),
    },
  });
  return { storeId: store.id };
}
