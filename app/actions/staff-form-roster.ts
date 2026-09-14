"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

export type StaffFormRosterResult = { status: "ok"; labels: string[] } | { status: "unauthorized" };

// Googleフォームの「お名前」選択肢欄に貼り付ける「店舗名 - 氏名」形式の一覧を生成する。
// 同姓同名の兼任スタッフ（例: 渋谷店と新宿店を兼任する松本陸さん）を区別するため、
// フォーム側は常に店舗名を併記した表記に統一する（設計書参照）。
export async function getStaffFormRoster(storeId: number): Promise<StaffFormRosterResult> {
  const session = await auth();
  if (!session?.user || (session.user.role !== "hq" && session.user.role !== "manager")) {
    return { status: "unauthorized" };
  }
  const scope = await getCurrentAdminStoreScope();
  if (!scope.isUnrestricted && !scope.storeIds.includes(storeId)) {
    return { status: "unauthorized" };
  }

  const staffList = await prisma.staff.findMany({
    where: { storeId, isActive: true },
    include: { store: true },
    orderBy: { id: "asc" },
  });

  return { status: "ok", labels: staffList.map((s) => `${s.store.name} - ${s.name}`) };
}
