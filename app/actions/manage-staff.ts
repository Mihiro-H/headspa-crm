"use server";

import { prisma } from "@/lib/db";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

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
  const scope = await getCurrentAdminStoreScope();

  const staff = await prisma.staff.findMany({
    where: scope.isUnrestricted ? undefined : { storeId: { in: scope.storeIds } },
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

export interface CreateStaffParams {
  storeId: number;
  name: string;
  bio: string | null;
  nominationFee: number;
}

export async function createStaff(params: CreateStaffParams): Promise<{ staffId: number }> {
  const staff = await prisma.staff.create({
    data: {
      storeId: params.storeId,
      name: params.name,
      bio: params.bio,
      nominationFee: params.nominationFee,
    },
  });
  return { staffId: staff.id };
}

export interface UpdateStaffProfileParams {
  staffId: number;
  name: string;
  bio: string | null;
  storeId: number;
}

export async function updateStaffProfile(params: UpdateStaffProfileParams): Promise<void> {
  await prisma.staff.update({
    where: { id: params.staffId },
    data: { name: params.name, bio: params.bio, storeId: params.storeId },
  });
}
