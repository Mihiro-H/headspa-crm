/**
 * 2025年4月〜2026年11月の予約・会員データをまとめて生成するスクリプト。
 *
 * - 会員は「ステータスがピラミッド型になる」ように、目標来店回数を先に決めて
 *   68名作成する（プラチナ1名〜ビジター40名）。性別は女性70%/男性25%/その他5%。
 * - 過去分（〜2026-09-11）はその会員の目標来店回数ぶん`completed`予約を生成し、
 *   実績からvisitCount・totalSpent・statusIdを確定させる。
 * - 未来分（2026-09-12〜11-30）は少数の`confirmed`予約を追加。9月は多め、
 *   10・11月は明確に少なくする（テーパリング）。
 * - 価格計算・キャンペーン解決は既存の`calculateReservationTotal`等を再利用し、
 *   実際の予約フローと同じ計算式にする。
 *
 * 「だいたいでいい」という前提のもと、以下は簡略化している：
 * - スタッフのシフト（StaffShift）は見ない（未整備のため）。
 * - ラグジュアリーカテゴリの最終受付時刻制限は見ない。
 * - スタッフの空き時間の衝突チェックはベストエフォート（数回リトライ後、
 *   衝突が解消しない場合は指名なしにフォールバックする）。
 *
 * 実行方法（ユーザー自身のターミナルで。.envが読める環境が必要）：
 *   npx tsx scripts/generate-history-data.ts
 */
import { PrismaClient, type Gender } from "@prisma/client";
import { dbTimeToMinutes, minutesToLabel } from "@/lib/reservation/time";
import { calculateCancellationDeadline } from "@/lib/reservation/cancellation-deadline";
import { calculateReservationTotal } from "@/lib/reservation/total-price";
import { resolveCourseCampaigns } from "@/app/actions/course-campaigns";

const prisma = new PrismaClient();

// ---- 日付範囲 ----
const PAST_START = new Date("2025-04-01T00:00:00.000Z");
const PAST_END = new Date("2026-09-11T00:00:00.000Z"); // 「今日」の前日まで
const FUTURE_START = new Date("2026-09-12T00:00:00.000Z"); // 「今日」
const FUTURE_END = new Date("2026-11-30T00:00:00.000Z");

// ---- 会員ステータスのピラミッド定義（[人数, 来店回数の範囲]） ----
const TIER_PLAN: Array<{ statusName: string; count: number; visitsMin: number; visitsMax: number }> = [
  { statusName: "プラチナ", count: 1, visitsMin: 22, visitsMax: 25 },
  { statusName: "ゴールド", count: 4, visitsMin: 11, visitsMax: 19 },
  { statusName: "シルバー", count: 8, visitsMin: 6, visitsMax: 10 },
  { statusName: "レギュラー", count: 15, visitsMin: 2, visitsMax: 5 },
  { statusName: "ビジター", count: 40, visitsMin: 1, visitsMax: 1 },
];

// ---- 未来分（テーパリング）の予約件数 ----
const FUTURE_RESERVATION_COUNT_BY_MONTH: Record<string, number> = {
  "2026-09": 30,
  "2026-10": 12,
  "2026-11": 6,
};

// ---- 性別比（女性70% / 男性25% / その他5%） ----
const GENDER_WEIGHTS: Array<{ gender: Gender; weight: number }> = [
  { gender: "female", weight: 70 },
  { gender: "male", weight: 25 },
  { gender: "other", weight: 5 },
];

const FEMALE_GIVEN_NAMES = [
  "花子", "美咲", "さくら", "恵美", "由紀", "千尋", "麻衣", "杏奈", "結衣", "陽子",
  "直美", "智子", "加奈", "優子", "真央", "美穂", "香織", "亜美", "沙織", "愛",
];
const MALE_GIVEN_NAMES = [
  "健太", "大輔", "拓也", "翔", "健二", "陸", "直樹", "誠", "浩二", "隆",
  "亮", "康平", "雄太", "和也", "圭",
];
const OTHER_GIVEN_NAMES = ["陽", "蓮", "碧", "光", "凛"];
const SURNAMES = [
  "田中", "佐藤", "鈴木", "高橋", "渡辺", "伊藤", "山本", "中村", "小林", "加藤",
  "吉田", "山田", "佐々木", "山口", "松本", "井上", "木村", "林", "斎藤", "清水",
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function weightedChoice<T>(items: Array<{ item: T; weight: number }>): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let r = Math.random() * total;
  for (const { item, weight } of items) {
    if (r < weight) return item;
    r -= weight;
  }
  return items[items.length - 1].item;
}

function randomDateBetween(start: Date, end: Date): Date {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const ms = startMs + Math.random() * (endMs - startMs);
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function nameForGender(gender: Gender): string {
  const given =
    gender === "female"
      ? randomChoice(FEMALE_GIVEN_NAMES)
      : gender === "male"
        ? randomChoice(MALE_GIVEN_NAMES)
        : randomChoice(OTHER_GIVEN_NAMES);
  return `${randomChoice(SURNAMES)} ${given}`;
}

function pickGender(): Gender {
  return weightedChoice(GENDER_WEIGHTS.map((g) => ({ item: g.gender, weight: g.weight })));
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

interface CourseRow {
  id: number;
  categoryId: number;
  price: number;
  treatmentTimeMin: number;
  genderRestriction: "none" | "female" | "male";
  campaignTargets: { campaign: never }[];
  category: { campaignTargets: { campaign: never }[] };
}

interface OptionRow {
  id: number;
  price: number;
  durationMin: number;
  genderRestriction: "none" | "female" | "male";
  discountExempt: boolean;
}

function eligibleFor<T extends { genderRestriction: "none" | "female" | "male" }>(
  items: T[],
  gender: Gender,
): T[] {
  return items.filter((i) => i.genderRestriction === "none" || i.genderRestriction === gender);
}

async function main() {
  const [stores, statuses, coursesRaw, optionsRaw] = await Promise.all([
    prisma.store.findMany({ orderBy: { id: "asc" } }),
    prisma.customerStatus.findMany({ orderBy: { minVisitCount: "asc" } }),
    prisma.course.findMany({
      where: { isPublished: true },
      include: {
        campaignTargets: { include: { campaign: { include: { storeTargets: true } } } },
        category: {
          include: {
            campaignTargets: { include: { campaign: { include: { storeTargets: true } } } },
          },
        },
      },
    }),
    prisma.option.findMany(),
  ]);

  const courses = coursesRaw as unknown as CourseRow[];
  const options = optionsRaw as unknown as OptionRow[];

  const staffByStore = new Map<number, { id: number; nominationFee: number }[]>();
  for (const store of stores) {
    const staff = await prisma.staff.findMany({
      where: { storeId: store.id, isActive: true },
      select: { id: true, nominationFee: true },
    });
    staffByStore.set(store.id, staff);
  }
  const storeWeights = stores.map((s) => ({
    item: s,
    weight: Math.max(1, staffByStore.get(s.id)?.length ?? 1),
  }));

  const holidaysByStore = new Map<number, Set<string>>();
  for (const store of stores) {
    const holidays = await prisma.storeHoliday.findMany({ where: { storeId: store.id } });
    holidaysByStore.set(
      store.id,
      new Set(holidays.map((h) => h.holidayDate.toISOString().slice(0, 10))),
    );
  }

  function statusIdForVisitCount(visitCount: number): number {
    let best = statuses[0];
    for (const s of statuses) {
      if (visitCount >= s.minVisitCount) best = s;
    }
    return best.id;
  }

  // 予約の重複チェック用（staffId × 日付 → 予約済み時間帯の配列）
  const staffBookings = new Map<string, Array<{ start: number; end: number }>>();

  function tryReserveSlot(
    storeId: number,
    staffId: number | null,
    date: Date,
    durationMin: number,
  ): { startMinutes: number; endMinutes: number } | null {
    const store = stores.find((s) => s.id === storeId)!;
    const weekend = isWeekend(date);
    const openMinutes = dbTimeToMinutes(weekend ? store.weekendOpen : store.weekdayOpen);
    const closeMinutes = dbTimeToMinutes(weekend ? store.weekendClose : store.weekdayClose);
    const latestStart = closeMinutes - durationMin;
    if (latestStart < openMinutes) return null;

    const slotCount = Math.floor((latestStart - openMinutes) / 30) + 1;
    const dateKey = date.toISOString().slice(0, 10);
    const bookingKey = staffId !== null ? `${staffId}_${dateKey}` : null;
    const existing = bookingKey ? staffBookings.get(bookingKey) ?? [] : [];

    for (let attempt = 0; attempt < 5; attempt++) {
      const startMinutes = openMinutes + randomInt(0, slotCount - 1) * 30;
      const endMinutes = startMinutes + durationMin;
      const conflict = existing.some((b) => overlaps(startMinutes, endMinutes, b.start, b.end));
      if (!conflict) {
        if (bookingKey) {
          existing.push({ start: startMinutes, end: endMinutes });
          staffBookings.set(bookingKey, existing);
        }
        return { startMinutes, endMinutes };
      }
    }
    return null;
  }

  async function createReservation(params: {
    memberId: number;
    memberGender: Gender;
    reservationDate: Date;
    status: "completed" | "confirmed";
  }): Promise<number> {
    const store = weightedChoice(storeWeights);
    const holidaySet = holidaysByStore.get(store.id) ?? new Set();
    const dateKey = params.reservationDate.toISOString().slice(0, 10);
    if (holidaySet.has(dateKey)) {
      // 定休日ならその日の別の日に振り直す（前日にシフト）
      params.reservationDate = new Date(params.reservationDate.getTime() - 86400000);
    }

    const eligibleCourses = eligibleFor(courses, params.memberGender);
    const course = randomChoice(eligibleCourses.length > 0 ? eligibleCourses : courses);
    const eligibleOptions = eligibleFor(options, params.memberGender);
    const chosenOptions: OptionRow[] = [];
    const optionCount = randomInt(0, 2);
    for (let i = 0; i < optionCount && eligibleOptions.length > 0; i++) {
      chosenOptions.push(randomChoice(eligibleOptions));
    }

    const totalDuration =
      course.treatmentTimeMin + chosenOptions.reduce((sum, o) => sum + o.durationMin, 0);

    const staffPool = staffByStore.get(store.id) ?? [];
    // 約15%は指名なし（staffId=null）。それ以外はスタッフをランダムに割り当てる。
    const wantsStaff = Math.random() > 0.15 && staffPool.length > 0;
    let staff = wantsStaff ? randomChoice(staffPool) : null;

    let slot = tryReserveSlot(store.id, staff?.id ?? null, params.reservationDate, totalDuration);
    if (!slot && staff) {
      // スタッフが埋まっていたら指名なしにフォールバック
      staff = null;
      slot = tryReserveSlot(store.id, null, params.reservationDate, totalDuration);
    }
    if (!slot) {
      // それでも取れない場合はこの1件はスキップ（呼び出し元でリトライしない簡易実装）
      throw new Error("SLOT_UNAVAILABLE");
    }

    const now = params.reservationDate;
    const campaigns = resolveCourseCampaigns(
      course as never,
      store.id,
      now,
    );
    const priced = calculateReservationTotal({
      course: { price: course.price, discountExempt: false, applicableCampaigns: campaigns },
      options: chosenOptions.map((o) => ({
        price: o.price,
        discountExempt: o.discountExempt,
        applicableCampaigns: [],
      })),
      nominationFee: staff?.nominationFee ?? 0,
    });

    // 既存の予約作成フロー（create-temp-hold.ts）と同じ構築方法に合わせる。
    const startTime = new Date(`1970-01-01T${minutesToLabel(slot.startMinutes)}:00.000Z`);
    const endTime = new Date(`1970-01-01T${minutesToLabel(slot.endMinutes)}:00.000Z`);

    const reservation = await prisma.reservation.create({
      data: {
        memberId: params.memberId,
        storeId: store.id,
        staffId: staff?.id ?? null,
        reservationDate: params.reservationDate,
        startTime,
        endTime,
        status: params.status,
        source: Math.random() < 0.6 ? "web" : "phone",
        nominationFeeApplied: priced.nominationFee,
        totalPrice: priced.totalPrice,
        cancellationDeadline: calculateCancellationDeadline(params.reservationDate),
        items: {
          create: [
            {
              itemType: "course",
              courseId: course.id,
              priceAtBooking: priced.course.finalPrice,
              appliedCampaignId: priced.course.appliedCampaignId,
            },
            ...priced.options.map((o, i) => ({
              itemType: "option" as const,
              optionId: chosenOptions[i].id,
              priceAtBooking: o.finalPrice,
              appliedCampaignId: o.appliedCampaignId,
            })),
          ],
        },
      },
    });

    return priced.totalPrice;
  }

  let memberSeq = 1;
  let createdMembers = 0;
  let createdCompletedReservations = 0;
  let createdFutureReservations = 0;
  const allMemberIds: Array<{ id: number; gender: Gender }> = [];

  for (const tier of TIER_PLAN) {
    for (let i = 0; i < tier.count; i++) {
      const gender = pickGender();
      const targetVisits = randomInt(tier.visitsMin, tier.visitsMax);
      const statusId = statusIdForVisitCount(targetVisits);

      const member = await prisma.member.create({
        data: {
          statusId,
          name: nameForGender(gender),
          email: `customer${memberSeq}@example.com`,
          phone: `090-${String(randomInt(1000, 9999))}-${String(randomInt(1000, 9999))}`,
          gender,
          birthMonth: randomInt(1, 12),
          visitCount: targetVisits,
          totalSpent: 0,
        },
      });
      memberSeq++;
      createdMembers++;
      allMemberIds.push({ id: member.id, gender });

      let totalSpent = 0;
      for (let v = 0; v < targetVisits; v++) {
        const date = randomDateBetween(PAST_START, PAST_END);
        try {
          const price = await createReservation({
            memberId: member.id,
            memberGender: gender,
            reservationDate: date,
            status: "completed",
          });
          totalSpent += price;
          createdCompletedReservations++;
        } catch {
          // スロットが確保できなかった1件はスキップ（visitCountとの厳密な整合は取らない、簡易実装）
        }
      }

      await prisma.member.update({ where: { id: member.id }, data: { totalSpent } });
    }
  }

  console.log(`\n会員 ${createdMembers}名 作成 / 過去の来店予約 ${createdCompletedReservations}件 作成`);

  for (const [monthKey, count] of Object.entries(FUTURE_RESERVATION_COUNT_BY_MONTH)) {
    const [year, month] = monthKey.split("-").map(Number);
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEndCandidate = new Date(Date.UTC(year, month, 0));
    const rangeStart = monthStart < FUTURE_START ? FUTURE_START : monthStart;
    const rangeEnd = monthEndCandidate > FUTURE_END ? FUTURE_END : monthEndCandidate;

    for (let i = 0; i < count; i++) {
      const target = randomChoice(allMemberIds);
      const date = randomDateBetween(rangeStart, rangeEnd);
      try {
        await createReservation({
          memberId: target.id,
          memberGender: target.gender,
          reservationDate: date,
          status: "confirmed",
        });
        createdFutureReservations++;
      } catch {
        // スキップ
      }
    }
  }

  console.log(`未来の確定予約 ${createdFutureReservations}件 作成`);
  console.log("\n完了しました。");
}

main()
  .catch((e) => {
    console.error("エラーが発生しました:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
