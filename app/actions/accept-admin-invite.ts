"use server";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export interface InviteDetails {
  name: string;
  email: string;
}

export type GetInviteDetailsResult =
  | { status: "valid"; admin: InviteDetails }
  | { status: "invalid" }
  | { status: "expired" };

export async function getInviteDetails(token: string): Promise<GetInviteDetailsResult> {
  const admin = await prisma.admin.findUnique({ where: { inviteToken: token } });
  if (!admin) {
    return { status: "invalid" };
  }
  if (!admin.inviteTokenExpiresAt || admin.inviteTokenExpiresAt < new Date()) {
    return { status: "expired" };
  }
  return { status: "valid", admin: { name: admin.name, email: admin.email } };
}

export type AcceptAdminInviteResult = { status: "accepted" } | { status: "invalid" } | { status: "expired" };

export async function acceptAdminInvite(
  token: string,
  password: string,
): Promise<AcceptAdminInviteResult> {
  const admin = await prisma.admin.findUnique({ where: { inviteToken: token } });
  if (!admin) {
    return { status: "invalid" };
  }
  if (!admin.inviteTokenExpiresAt || admin.inviteTokenExpiresAt < new Date()) {
    return { status: "expired" };
  }

  const passwordHash = await hashPassword(password);
  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash, inviteToken: null, inviteTokenExpiresAt: null },
  });

  return { status: "accepted" };
}
