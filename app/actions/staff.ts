"use server";

import { prisma } from "@/lib/db";

export interface StaffListItem {
  id: number;
  name: string;
  photoUrl: string | null;
  bio: string | null;
  nominationFee: number;
}

export async function listStaffForStore(storeId: number): Promise<StaffListItem[]> {
  const staff = await prisma.staff.findMany({
    where: { storeId, isActive: true },
    orderBy: { id: "asc" },
  });
  return staff.map((s) => ({
    id: s.id,
    name: s.name,
    photoUrl: s.photoUrl,
    bio: s.bio,
    nominationFee: s.nominationFee,
  }));
}
