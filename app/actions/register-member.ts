"use server";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export interface RegisterMemberParams {
  name: string;
  email: string;
  phone: string;
  password: string;
  birthDate: string;
  gender: "female" | "male" | "other";
}

export type RegisterMemberResult =
  | { status: "created"; memberId: number }
  | { status: "email_taken" };

export async function registerMember(
  params: RegisterMemberParams,
): Promise<RegisterMemberResult> {
  const existing = await prisma.member.findUnique({ where: { email: params.email } });
  if (existing) {
    return { status: "email_taken" };
  }

  const passwordHash = await hashPassword(params.password);
  const defaultStatus = await prisma.customerStatus.findFirstOrThrow({
    orderBy: { sortOrder: "asc" },
  });

  const member = await prisma.member.create({
    data: {
      name: params.name,
      email: params.email,
      phone: params.phone,
      passwordHash,
      birthDate: new Date(`${params.birthDate}T00:00:00.000Z`),
      gender: params.gender,
      statusId: defaultStatus.id,
    },
  });

  return { status: "created", memberId: member.id };
}
