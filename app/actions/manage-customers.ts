"use server";

import { prisma } from "@/lib/db";
import type { MemberGender } from "@/lib/reservation/gender-restriction";

export interface CreateCustomerByAdminParams {
  name: string;
  email: string;
  phone: string;
  gender: MemberGender;
  birthMonth: number;
  primaryStoreId: number | null;
}

export type CreateCustomerByAdminResult =
  | { status: "created"; memberId: number }
  | { status: "email_taken" };

export async function createCustomerByAdmin(
  params: CreateCustomerByAdminParams,
): Promise<CreateCustomerByAdminResult> {
  const existing = await prisma.member.findUnique({ where: { email: params.email } });
  if (existing) {
    return { status: "email_taken" };
  }

  const defaultStatus = await prisma.customerStatus.findFirstOrThrow({
    orderBy: { sortOrder: "asc" },
  });

  const member = await prisma.member.create({
    data: {
      name: params.name,
      email: params.email,
      phone: params.phone,
      gender: params.gender,
      birthMonth: params.birthMonth,
      primaryStoreId: params.primaryStoreId,
      statusId: defaultStatus.id,
    },
  });

  return { status: "created", memberId: member.id };
}

export interface UpdateCustomerByAdminParams {
  memberId: number;
  name: string;
  phone: string;
  primaryStoreId: number | null;
}

export async function updateCustomerByAdmin(params: UpdateCustomerByAdminParams): Promise<void> {
  await prisma.member.update({
    where: { id: params.memberId },
    data: {
      name: params.name,
      phone: params.phone,
      primaryStoreId: params.primaryStoreId,
    },
  });
}

export async function deactivateCustomer(memberId: number): Promise<void> {
  await prisma.member.update({ where: { id: memberId }, data: { isActive: false } });
}

export async function reactivateCustomer(memberId: number): Promise<void> {
  await prisma.member.update({ where: { id: memberId }, data: { isActive: true } });
}
