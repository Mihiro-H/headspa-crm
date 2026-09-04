"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export interface MemberProfile {
  name: string;
  phone: string;
  birthMonth: number;
  gender: "female" | "male" | "other";
  hasPassword: boolean;
  lineLinked: boolean;
  emailNotificationEnabled: boolean;
  lineNotificationEnabled: boolean;
}

export async function getMemberProfile(): Promise<MemberProfile | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return null;
  }
  const memberId = Number(session.user.id);

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return null;

  return {
    name: member.name,
    phone: member.phone,
    birthMonth: member.birthMonth,
    gender: member.gender,
    hasPassword: member.passwordHash !== null,
    lineLinked: member.lineUserId !== null,
    emailNotificationEnabled: member.emailNotificationEnabled,
    lineNotificationEnabled: member.lineNotificationEnabled,
  };
}

export interface UpdateMemberProfileParams {
  name: string;
  phone: string;
  birthMonth: number;
  gender: "female" | "male" | "other";
  emailNotificationEnabled: boolean;
  lineNotificationEnabled: boolean;
}

export type UpdateMemberProfileResult = { status: "updated" } | { status: "unauthorized" };

export async function updateMemberProfile(
  params: UpdateMemberProfileParams,
): Promise<UpdateMemberProfileResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return { status: "unauthorized" };
  }
  const memberId = Number(session.user.id);

  await prisma.member.update({
    where: { id: memberId },
    data: {
      name: params.name,
      phone: params.phone,
      birthMonth: params.birthMonth,
      gender: params.gender,
      emailNotificationEnabled: params.emailNotificationEnabled,
      lineNotificationEnabled: params.lineNotificationEnabled,
    },
  });

  return { status: "updated" };
}

export type ChangeMemberPasswordResult =
  | { status: "updated" }
  | { status: "unauthorized" }
  | { status: "incorrect_current_password" };

export async function changeMemberPassword(params: {
  currentPassword: string | null;
  newPassword: string;
}): Promise<ChangeMemberPasswordResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return { status: "unauthorized" };
  }
  const memberId = Number(session.user.id);

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return { status: "unauthorized" };

  if (member.passwordHash) {
    if (
      !params.currentPassword ||
      !(await verifyPassword(params.currentPassword, member.passwordHash))
    ) {
      return { status: "incorrect_current_password" };
    }
  }

  const newHash = await hashPassword(params.newPassword);
  await prisma.member.update({ where: { id: memberId }, data: { passwordHash: newHash } });

  return { status: "updated" };
}
