/**
 * 各店舗のスタッフを3〜4名に揃えるための追加スクリプト。
 *
 * - 新宿店・渋谷店には「松本 陸」を1名兼任として、それぞれの店舗に
 *   別のstaff_idで1行ずつ登録する（Staffモデルに店舗を複数持たせる
 *   仕組み（中間テーブル）がないため、同名の行を2件作る運用）。
 * - 各店舗に少なくとも1名、男性とわかる名前のスタッフを含める。
 * - 指名料は500円/1,000円を混在させ、兼任の松本陸は両店舗とも1,000円。
 * - 同名・同店舗のスタッフが既に存在する場合はスキップする（再実行しても安全）。
 *
 * 実行方法（ユーザー自身のターミナルで。.envが読める環境が必要）：
 *   npx tsx scripts/add-staff.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface StaffSeed {
  storeName: string;
  name: string;
  nominationFee: number;
}

const STAFF_SEEDS: StaffSeed[] = [
  // 池袋店
  { storeName: "フォレスパ 池袋店", name: "伊藤 大輔", nominationFee: 500 },
  { storeName: "フォレスパ 池袋店", name: "加藤 美和", nominationFee: 1000 },
  { storeName: "フォレスパ 池袋店", name: "渡辺 さくら", nominationFee: 500 },
  { storeName: "フォレスパ 池袋店", name: "中島 拓也", nominationFee: 1000 },

  // 渋谷店（松本陸は新宿店と兼任）
  { storeName: "フォレスパ 渋谷店", name: "松本 陸", nominationFee: 1000 },
  { storeName: "フォレスパ 渋谷店", name: "小林 恵美", nominationFee: 500 },
  { storeName: "フォレスパ 渋谷店", name: "石井 杏奈", nominationFee: 1000 },

  // 新宿店（山本遥は既存のため対象外。松本陸は渋谷店と兼任）
  { storeName: "フォレスパ 新宿店", name: "松本 陸", nominationFee: 1000 },
  { storeName: "フォレスパ 新宿店", name: "田村 結衣", nominationFee: 500 },

  // 東京丸の内本店
  { storeName: "フォレスパ 東京丸の内本店", name: "佐々木 翔", nominationFee: 1000 },
  { storeName: "フォレスパ 東京丸の内本店", name: "岡田 千尋", nominationFee: 500 },
  { storeName: "フォレスパ 東京丸の内本店", name: "吉田 麻衣", nominationFee: 1000 },
  { storeName: "フォレスパ 東京丸の内本店", name: "藤田 健二", nominationFee: 500 },
];

async function main() {
  let createdCount = 0;
  let skippedCount = 0;

  for (const seed of STAFF_SEEDS) {
    const store = await prisma.store.findUnique({ where: { name: seed.storeName } });
    if (!store) {
      console.error(`店舗が見つかりません: ${seed.storeName}（スキップ）`);
      continue;
    }

    const existing = await prisma.staff.findFirst({
      where: { storeId: store.id, name: seed.name },
    });
    if (existing) {
      console.log(`既に存在するためスキップ: ${seed.storeName} / ${seed.name}`);
      skippedCount++;
      continue;
    }

    await prisma.staff.create({
      data: {
        storeId: store.id,
        name: seed.name,
        nominationFee: seed.nominationFee,
      },
    });
    console.log(`追加しました: ${seed.storeName} / ${seed.name}（指名料${seed.nominationFee}円）`);
    createdCount++;
  }

  console.log(`\n完了：追加${createdCount}件、スキップ${skippedCount}件`);
}

main()
  .catch((e) => {
    console.error("エラーが発生しました:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
