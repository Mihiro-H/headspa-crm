/**
 * 店舗ごとの現在のスタッフ一覧を確認するスクリプト（読み取り専用）。
 *
 * 各店舗のスタッフを3〜4名に揃えるための追加作業前に、
 * 現状の人数・名前を確認するために使う。
 *
 * 実行方法（ユーザー自身のターミナルで。.envが読める環境が必要）：
 *   npx tsx scripts/list-staff-by-store.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const stores = await prisma.store.findMany({ orderBy: { id: "asc" } });

  for (const store of stores) {
    const staff = await prisma.staff.findMany({
      where: { storeId: store.id },
      orderBy: { id: "asc" },
    });
    console.log(`\n=== ${store.name}（store_id=${store.id}） ===`);
    console.log(`現在のスタッフ数: ${staff.length}`);
    for (const s of staff) {
      console.log(
        `  staff_id=${s.id} name=${s.name} isActive=${s.isActive} nominationFee=${s.nominationFee}`,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error("エラーが発生しました:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
