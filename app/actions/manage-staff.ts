"use server";

import { prisma } from "@/lib/db";

export interface ManagedStaff {
  id: number;
  name: string;
  bio: string | null;
  nominationFee: number;
  isActive: boolean;
  storeId: number;
  storeName: string;
}

export async function listAllStaff(): Promise<ManagedStaff[]> {
  const staff = await prisma.staff.findMany({
    include: { store: true },
    orderBy: [{ storeId: "asc" }, { id: "asc" }],
  });

  return staff.map((s) => ({
    id: s.id,
    name: s.name,
    bio: s.bio,
    nominationFee: s.nominationFee,
    isActive: s.isActive,
    storeId: s.store.id,
    storeName: s.store.name,
  }));
}

export interface UpdateStaffParams {
  staffId: number;
  nominationFee: number;
  isActive: boolean;
}

export async function updateStaff(params: UpdateStaffParams): Promise<void> {
  await prisma.staff.update({
    where: { id: params.staffId },
    data: { nominationFee: params.nominationFee, isActive: params.isActive },
  });
}
