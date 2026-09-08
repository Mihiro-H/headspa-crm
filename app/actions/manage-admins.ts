"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/delivery/send-email";
import type { AdminRole } from "@prisma/client";

// Server Actionはページのミドルウェアガードに関わらず直接呼び出せるため、
// 管理者向けアクションは必ずそれぞれの関数内でセッションを検証する。
const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

const INVITE_EXPIRY_DAYS = 7;

export interface AdminListItem {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  isPending: boolean; // true = 招待メール送信済みだがパスワード未設定
  storeIds: number[];
  storeNames: string[];
}

export async function listAdmins(): Promise<AdminListItem[]> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const admins = await prisma.admin.findMany({
    include: { stores: { include: { store: true } } },
    orderBy: { id: "asc" },
  });
  return admins.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    isActive: a.isActive,
    isPending: a.passwordHash === null,
    storeIds: a.stores.map((s) => s.storeId),
    storeNames: a.stores.map((s) => s.store.name),
  }));
}

function buildInviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl}/admin/accept-invite?token=${token}`;
}

function inviteEmailBody(name: string, inviteUrl: string): string {
  return `${name}様\n\n管理画面アカウントが作成されました。以下のリンクからパスワードを設定してください（7日間有効です）。\n\n${inviteUrl}\n\nこのメールに心当たりがない場合は破棄してください。`;
}

function inviteExpiresAt(): Date {
  return new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

export interface CreateAdminParams {
  name: string;
  email: string;
  role: AdminRole;
  storeIds: number[];
}

export type CreateAdminResult =
  | {
      status: "invited";
      adminId: number;
      emailStatus: "sent" | "not_configured" | "failed";
      inviteUrl: string;
    }
  | { status: "email_taken" };

export async function createAdmin(params: CreateAdminParams): Promise<CreateAdminResult> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const existing = await prisma.admin.findUnique({ where: { email: params.email } });
  if (existing) {
    return { status: "email_taken" };
  }

  const inviteToken = crypto.randomUUID();

  const admin = await prisma.admin.create({
    data: {
      name: params.name,
      email: params.email,
      role: params.role,
      passwordHash: null,
      inviteToken,
      inviteTokenExpiresAt: inviteExpiresAt(),
      stores: { create: params.storeIds.map((storeId) => ({ storeId })) },
    },
  });

  const inviteUrl = buildInviteUrl(inviteToken);
  const emailResult = await sendEmail({
    to: params.email,
    subject: "【フォレスパ】管理画面アカウントのご招待",
    body: inviteEmailBody(params.name, inviteUrl),
  });

  return { status: "invited", adminId: admin.id, emailStatus: emailResult.status, inviteUrl };
}

export type ResendInviteResult =
  | { status: "resent"; emailStatus: "sent" | "not_configured" | "failed"; inviteUrl: string }
  | { status: "already_active" }
  | { status: "not_found" };

// Brevo未設定期間中に送信できなかった招待、または期限切れになった招待をやり直すための再送機能。
export async function resendAdminInvite(adminId: number): Promise<ResendInviteResult> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin) {
    return { status: "not_found" };
  }
  if (admin.passwordHash !== null) {
    return { status: "already_active" };
  }

  const inviteToken = crypto.randomUUID();
  await prisma.admin.update({
    where: { id: adminId },
    data: { inviteToken, inviteTokenExpiresAt: inviteExpiresAt() },
  });

  const inviteUrl = buildInviteUrl(inviteToken);
  const emailResult = await sendEmail({
    to: admin.email,
    subject: "【フォレスパ】管理画面アカウントのご招待（再送）",
    body: inviteEmailBody(admin.name, inviteUrl),
  });

  return { status: "resent", emailStatus: emailResult.status, inviteUrl };
}

export interface UpdateAdminParams {
  adminId: number;
  name: string;
  role: AdminRole;
  storeIds: number[];
}

export async function updateAdmin(params: UpdateAdminParams): Promise<void> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  await prisma.admin.update({
    where: { id: params.adminId },
    data: {
      name: params.name,
      role: params.role,
      stores: { deleteMany: {}, create: params.storeIds.map((storeId) => ({ storeId })) },
    },
  });
}

export async function deactivateAdmin(adminId: number): Promise<void> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  await prisma.admin.update({ where: { id: adminId }, data: { isActive: false } });
}

export async function reactivateAdmin(adminId: number): Promise<void> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  await prisma.admin.update({ where: { id: adminId }, data: { isActive: true } });
}
