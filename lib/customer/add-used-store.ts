import { prisma } from "@/lib/db";

// 予約が確定するたびに呼び出し、その予約店舗を顧客の「利用店舗」に追加する。
// 既に登録済みの店舗であれば何もしない（upsertのupdate部分は空）。
export async function addUsedStore(memberId: number, storeId: number): Promise<void> {
  await prisma.memberStore.upsert({
    where: { memberId_storeId: { memberId, storeId } },
    create: { memberId, storeId },
    update: {},
  });
}
