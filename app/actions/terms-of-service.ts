"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Server Actionはページのミドルウェアガードに関わらず直接呼び出せるため、
// 管理者向けアクションは必ずそれぞれの関数内でセッションを検証する。
const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

export async function getTermsOfService(): Promise<string> {
  const record = await prisma.termsOfService.findUnique({ where: { id: 1 } });
  return record?.bodyText ?? "";
}

export async function updateTermsOfService(bodyText: string): Promise<void> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  await prisma.termsOfService.upsert({
    where: { id: 1 },
    create: { id: 1, bodyText },
    update: { bodyText },
  });
}
