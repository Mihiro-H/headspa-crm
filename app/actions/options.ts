"use server";

import { prisma } from "@/lib/db";
import type { GenderRestriction } from "@/lib/reservation/gender-restriction";

export interface OptionListItem {
  id: number;
  name: string;
  price: number;
  genderRestriction: GenderRestriction;
  requiresAdvanceBooking: boolean;
  discountExempt: boolean;
}

export async function listOptions(): Promise<OptionListItem[]> {
  const options = await prisma.option.findMany({ orderBy: { id: "asc" } });
  return options.map((o) => ({
    id: o.id,
    name: o.name,
    price: o.price,
    genderRestriction: o.genderRestriction,
    requiresAdvanceBooking: o.requiresAdvanceBooking,
    discountExempt: o.discountExempt,
  }));
}
