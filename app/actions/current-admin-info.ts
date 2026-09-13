"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { AdminRole } from "@prisma/client";

export interface CurrentAdminInfo {
  name: string;
  role: AdminRole;
  storeNames: string[];
}

// ヘッダーのアカウントメニューは「自分自身」の情報だけを表示すればよいため、
// 他Adminのidを受け取らずセッションから直接引く設計にしている
// （manage-admins.tsのlistAdminsのような全件取得系アクションを流用しない）。
export async function getCurrentAdminInfo(): Promise<CurrentAdminInfo | null> {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const admin = await prisma.admin.findUnique({
    where: { id: Number(session.user.id) },
    include: { stores: { include: { store: true } } },
  });
  if (!admin) {
    return null;
  }

  return {
    name: admin.name,
    role: admin.role,
    storeNames: admin.stores.map((s) => s.store.name),
  };
}
