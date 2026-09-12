import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";

const prisma = new PrismaClient();

// 開発環境でログイン確認用に使う管理者アカウント。本番投入時は必ずパスワードを変更すること。
const ADMIN_SEED_EMAIL = "admin@foresupa.example.com";
const ADMIN_SEED_PASSWORD = "ForeSupa2026!";

async function main() {
  const stores = await Promise.all(
    [
      {
        name: "フォレスパ 東京丸の内本店",
        phone: "03-0000-0001",
        weekdayOpen: new Date("1970-01-01T11:00:00Z"),
        weekdayClose: new Date("1970-01-01T20:00:00Z"),
        weekendOpen: new Date("1970-01-01T10:00:00Z"),
        weekendClose: new Date("1970-01-01T18:00:00Z"),
        luxuryLastOrderWeekday: new Date("1970-01-01T19:30:00Z"),
        luxuryLastOrderWeekend: new Date("1970-01-01T17:30:00Z"),
        nearestStation: "東京駅 徒歩5分・大手町駅 徒歩7分",
      },
      {
        name: "フォレスパ 渋谷店",
        phone: "03-0000-0002",
        weekdayOpen: new Date("1970-01-01T11:00:00Z"),
        weekdayClose: new Date("1970-01-01T18:30:00Z"),
        weekendOpen: new Date("1970-01-01T10:00:00Z"),
        weekendClose: new Date("1970-01-01T17:30:00Z"),
        luxuryLastOrderWeekday: new Date("1970-01-01T18:00:00Z"),
        luxuryLastOrderWeekend: new Date("1970-01-01T17:00:00Z"),
        nearestStation: "渋谷駅 徒歩8分",
      },
      {
        name: "フォレスパ 池袋店",
        phone: "03-0000-0003",
        weekdayOpen: new Date("1970-01-01T11:00:00Z"),
        weekdayClose: new Date("1970-01-01T18:30:00Z"),
        weekendOpen: new Date("1970-01-01T10:00:00Z"),
        weekendClose: new Date("1970-01-01T17:30:00Z"),
        luxuryLastOrderWeekday: new Date("1970-01-01T18:00:00Z"),
        luxuryLastOrderWeekend: new Date("1970-01-01T17:00:00Z"),
        nearestStation: "池袋駅 徒歩4分",
      },
      {
        name: "フォレスパ 新宿店",
        phone: "03-0000-0004",
        weekdayOpen: new Date("1970-01-01T11:00:00Z"),
        weekdayClose: new Date("1970-01-01T18:30:00Z"),
        weekendOpen: new Date("1970-01-01T10:00:00Z"),
        weekendClose: new Date("1970-01-01T17:30:00Z"),
        luxuryLastOrderWeekday: new Date("1970-01-01T18:00:00Z"),
        luxuryLastOrderWeekend: new Date("1970-01-01T17:00:00Z"),
        nearestStation: "新宿駅1番出口 徒歩8分・新宿三丁目南口 徒歩2分",
      },
    ].map((store) =>
      prisma.store.upsert({
        where: { name: store.name },
        update: {},
        create: store,
      }),
    ),
  );

  await Promise.all(
    [
      { name: "ビジター", minVisitCount: 1, colorCode: "#A9A08D", sortOrder: 1 },
      { name: "レギュラー", minVisitCount: 2, colorCode: "#8AAB78", sortOrder: 2 },
      { name: "シルバー", minVisitCount: 6, colorCode: "#ADB7BD", sortOrder: 3 },
      { name: "ゴールド", minVisitCount: 11, colorCode: "#C9A66B", sortOrder: 4 },
      { name: "プラチナ", minVisitCount: 21, colorCode: "#8D7B9E", sortOrder: 5 },
    ].map((status) =>
      prisma.customerStatus.upsert({
        where: { name: status.name },
        update: {},
        create: status,
      }),
    ),
  );

  const courseCategories = await Promise.all(
    [
      { name: "頭皮ケア重点", sortOrder: 1, genderRestriction: "none" as const },
      { name: "頭皮マッサージ重点", sortOrder: 2, genderRestriction: "none" as const },
      { name: "ヘアエステ重点", sortOrder: 3, genderRestriction: "none" as const },
      { name: "フォーメン", sortOrder: 4, genderRestriction: "male" as const },
      { name: "スペシャルダブルケア", sortOrder: 5, genderRestriction: "none" as const },
      { name: "ラグジュアリー", sortOrder: 6, genderRestriction: "none" as const },
    ].map((category) =>
      prisma.courseCategory.upsert({
        where: { name: category.name },
        update: {},
        create: category,
      }),
    ),
  );

  // コース本体（カテゴリ×スタンダード/プレミアムの2段階）。
  // Course.nameはカテゴリをまたいで一意ではないため、upsertではなく
  // 「同一カテゴリ内に同名コースがなければ作成する」方式で冪等にする。
  const courseSeeds = [
    { categoryName: "頭皮ケア重点", name: "スタンダード", durationEstimateMin: 60, treatmentTimeMin: 50, price: 8000, sortOrder: 1, genderRestriction: "none" as const },
    { categoryName: "頭皮ケア重点", name: "プレミアム", durationEstimateMin: 90, treatmentTimeMin: 80, price: 12000, sortOrder: 2, genderRestriction: "none" as const },
    { categoryName: "頭皮マッサージ重点", name: "スタンダード", durationEstimateMin: 60, treatmentTimeMin: 50, price: 8500, sortOrder: 1, genderRestriction: "none" as const },
    { categoryName: "頭皮マッサージ重点", name: "プレミアム", durationEstimateMin: 90, treatmentTimeMin: 80, price: 13000, sortOrder: 2, genderRestriction: "none" as const },
    { categoryName: "ヘアエステ重点", name: "スタンダード", durationEstimateMin: 70, treatmentTimeMin: 60, price: 9000, sortOrder: 1, genderRestriction: "none" as const },
    { categoryName: "ヘアエステ重点", name: "プレミアム", durationEstimateMin: 100, treatmentTimeMin: 90, price: 14000, sortOrder: 2, genderRestriction: "none" as const },
    { categoryName: "フォーメン", name: "スタンダード", durationEstimateMin: 50, treatmentTimeMin: 40, price: 7000, sortOrder: 1, genderRestriction: "male" as const },
    { categoryName: "フォーメン", name: "プレミアム", durationEstimateMin: 80, treatmentTimeMin: 70, price: 11000, sortOrder: 2, genderRestriction: "male" as const },
    { categoryName: "スペシャルダブルケア", name: "スタンダード", durationEstimateMin: 100, treatmentTimeMin: 90, price: 15000, sortOrder: 1, genderRestriction: "none" as const },
    { categoryName: "スペシャルダブルケア", name: "プレミアム", durationEstimateMin: 130, treatmentTimeMin: 120, price: 20000, sortOrder: 2, genderRestriction: "none" as const },
    { categoryName: "ラグジュアリー", name: "スタンダード", durationEstimateMin: 120, treatmentTimeMin: 110, price: 22000, sortOrder: 1, genderRestriction: "none" as const },
    { categoryName: "ラグジュアリー", name: "プレミアム", durationEstimateMin: 150, treatmentTimeMin: 140, price: 28000, sortOrder: 2, genderRestriction: "none" as const },
  ];

  let seededCourseCount = 0;
  for (const seed of courseSeeds) {
    const category = courseCategories.find((c) => c.name === seed.categoryName);
    if (!category) continue;

    const existing = await prisma.course.findFirst({
      where: { categoryId: category.id, name: seed.name },
    });
    if (existing) continue;

    await prisma.course.create({
      data: {
        categoryId: category.id,
        name: seed.name,
        durationEstimateMin: seed.durationEstimateMin,
        treatmentTimeMin: seed.treatmentTimeMin,
        price: seed.price,
        genderRestriction: seed.genderRestriction,
        sortOrder: seed.sortOrder,
      },
    });
    seededCourseCount++;
  }

  // オプション（画面仕様書M-02 Step4に記載の4種）。
  const optionSeeds = [
    {
      name: "ハンド・マッサージ",
      durationMin: 15,
      price: 1500,
      genderRestriction: "none" as const,
      requiresAdvanceBooking: true,
      discountExempt: true,
    },
    {
      name: "追加マッサージ",
      durationMin: 15,
      price: 1500,
      genderRestriction: "none" as const,
      requiresAdvanceBooking: true,
      discountExempt: true,
    },
    {
      name: "デコルテ・マッサージ",
      durationMin: 20,
      price: 2000,
      genderRestriction: "male" as const,
      requiresAdvanceBooking: true,
      discountExempt: true,
    },
    {
      name: "眼精疲労かっさ",
      durationMin: 15,
      price: 1500,
      genderRestriction: "none" as const,
      requiresAdvanceBooking: true,
      discountExempt: true,
    },
  ];

  let seededOptionCount = 0;
  for (const seed of optionSeeds) {
    const existing = await prisma.option.findFirst({ where: { name: seed.name } });
    if (existing) continue;

    await prisma.option.create({ data: seed });
    seededOptionCount++;
  }

  // 管理者アカウント（本部権限）。email一意制約でupsertし、再実行時にパスワードを
  // 意図せず再ハッシュ・上書きしないよう新規作成時のみハッシュ化する。
  const existingAdmin = await prisma.admin.findUnique({ where: { email: ADMIN_SEED_EMAIL } });
  if (!existingAdmin) {
    await prisma.admin.create({
      data: {
        // hqロールは店舗スコープなし（admin_storesへの行を作らない）が正しい状態。
        name: "システム管理者",
        email: ADMIN_SEED_EMAIL,
        passwordHash: await hashPassword(ADMIN_SEED_PASSWORD),
        role: "hq",
      },
    });
  }

  console.log(`Seeded ${stores.length} stores.`);
  console.log(`Seeded ${seededCourseCount} courses.`);
  console.log(`Seeded ${seededOptionCount} options.`);
  console.log(`Admin account: ${ADMIN_SEED_EMAIL} (created if not already present).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
