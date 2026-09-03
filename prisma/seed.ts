import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

  await Promise.all(
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

  console.log(`Seeded ${stores.length} stores.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
