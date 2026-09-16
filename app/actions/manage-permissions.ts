"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { AdminRole, PermissionLevel } from "@prisma/client";

// Server Actionはページのミドルウェアガードに関わらず直接呼び出せるため、
// 管理者向けアクションは必ずそれぞれの関数内でセッションを検証する。
const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

export interface PagePermissionItem {
  role: AdminRole;
  pageKey: string;
  level: PermissionLevel;
}

export async function listPermissions(): Promise<PagePermissionItem[]> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  return prisma.rolePagePermission.findMany();
}

export async function setPermission(
  role: AdminRole,
  pageKey: string,
  level: PermissionLevel,
): Promise<void> {
  const session = await auth();
  if (!session?.user || session.user.role !== "hq") {
    throw new Error("unauthorized");
  }

  await prisma.rolePagePermission.upsert({
    where: { role_pageKey: { role, pageKey } },
    create: { role, pageKey, level },
    update: { level },
  });
}
