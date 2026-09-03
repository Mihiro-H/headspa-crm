# フォレスパ Phase 8: 予約詳細・電話予約登録（A-04） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 予約詳細表示・キャンセル・No-show登録・電話予約の新規登録（A-04）を実装し、予約カレンダー（A-03）から予約詳細へ遷移できるようにする。

**Architecture:** 電話予約は`source: "phone"`・`status: "confirmed"`で直接作成する（WEB予約の`temp_hold`のような2段階確保は不要。スタッフが電話口でその場作成するため）。会員検索は既存の顧客管理検索（`searchCustomers`）を流用する。

**Tech Stack:** Next.js App Router / TypeScript / Tailwind v4（既存Phase 0〜7基盤を使用）

**参照元資料:** `02_screenspecification.md`（A-04節）

**このPhaseで作らないもの:** 新規会員をその場で作成するフロー（電話予約は既存会員のみ対象とする。新規顧客は別途会員登録が必要という運用にする）、予約変更（日時変更）機能（キャンセル＋再作成で代替）。

> **実行環境に関する注記（継承）:** `.git`書き込み不可（コミットは後回し）、`.env`系ファイル読み書き不可、`npm run build`/`npm run dev`は不安定（`tsc --noEmit`/`eslint`/`vitest`を使う）。UIコンポーネントは軽量検証（tsc/eslintのみ）、データ取得・更新系Server ActionsはTDD。

---

## Task 1: 予約詳細取得・キャンセル・No-show登録Server Action（TDD）

**Files:**
- Create: `app/actions/reservation-detail.ts`
- Test: `app/actions/reservation-detail.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`app/actions/reservation-detail.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getReservationDetail, cancelReservation, markNoShow } from "./reservation-detail";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

describe("getReservationDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the reservation does not exist", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(null as never);
    expect(await getReservationDetail(999)).toBeNull();
  });

  it("maps a reservation with member/store/staff/items", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 1,
      status: "confirmed",
      source: "phone",
      reservationDate: new Date("2026-09-20T00:00:00Z"),
      startTime: new Date("1970-01-01T11:00:00Z"),
      endTime: new Date("1970-01-01T12:00:00Z"),
      totalPrice: 8000,
      member: { id: 5, name: "佐藤 太郎", phone: "090-0000-0000" },
      store: { name: "フォレスパ 渋谷店" },
      staff: { name: "田中 花子" },
      items: [
        { itemType: "course", course: { name: "スタンダード" }, option: null },
        { itemType: "option", course: null, option: { name: "ハンド・マッサージ" } },
      ],
    } as never);

    const result = await getReservationDetail(1);

    expect(result).toEqual({
      id: 1,
      status: "confirmed",
      source: "phone",
      reservationDate: "2026-09-20",
      startTimeLabel: "11:00",
      endTimeLabel: "12:00",
      totalPrice: 8000,
      memberId: 5,
      memberName: "佐藤 太郎",
      memberPhone: "090-0000-0000",
      storeName: "フォレスパ 渋谷店",
      staffName: "田中 花子",
      courseName: "スタンダード",
      optionNames: ["ハンド・マッサージ"],
    });
  });
});

describe("cancelReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the reservation status to cancelled", async () => {
    vi.mocked(prisma.reservation.update).mockResolvedValue({} as never);

    await cancelReservation(1);

    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "cancelled" },
    });
  });
});

describe("markNoShow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the reservation status to no_show", async () => {
    vi.mocked(prisma.reservation.update).mockResolvedValue({} as never);

    await markNoShow(1);

    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "no_show" },
    });
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/reservation-detail.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/reservation-detail.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";
import { minutesToLabel, dbTimeToMinutes } from "@/lib/reservation/time";

export interface ReservationDetail {
  id: number;
  status: string;
  source: string;
  reservationDate: string;
  startTimeLabel: string;
  endTimeLabel: string;
  totalPrice: number;
  memberId: number | null;
  memberName: string | null;
  memberPhone: string | null;
  storeName: string;
  staffName: string | null;
  courseName: string;
  optionNames: string[];
}

export async function getReservationDetail(
  reservationId: number,
): Promise<ReservationDetail | null> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      member: true,
      store: true,
      staff: true,
      items: { include: { course: true, option: true } },
    },
  });

  if (!reservation) return null;

  const courseItem = reservation.items.find((i) => i.itemType === "course");
  const optionItems = reservation.items.filter((i) => i.itemType === "option");

  return {
    id: reservation.id,
    status: reservation.status,
    source: reservation.source,
    reservationDate: reservation.reservationDate.toISOString().slice(0, 10),
    startTimeLabel: minutesToLabel(dbTimeToMinutes(reservation.startTime)),
    endTimeLabel: minutesToLabel(dbTimeToMinutes(reservation.endTime)),
    totalPrice: reservation.totalPrice,
    memberId: reservation.member?.id ?? null,
    memberName: reservation.member?.name ?? null,
    memberPhone: reservation.member?.phone ?? null,
    storeName: reservation.store.name,
    staffName: reservation.staff?.name ?? null,
    courseName: courseItem?.course?.name ?? "",
    optionNames: optionItems.map((i) => i.option?.name ?? "").filter(Boolean),
  };
}

export async function cancelReservation(reservationId: number): Promise<void> {
  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "cancelled" },
  });
}

export async function markNoShow(reservationId: number): Promise<void> {
  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "no_show" },
  });
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/reservation-detail.test.ts
```

Expected: PASS（4 tests）

- [x] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [x] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 2: 電話予約作成Server Action（TDD）

**Files:**
- Create: `app/actions/create-phone-reservation.ts`
- Test: `app/actions/create-phone-reservation.test.ts`

**注記:** WEB予約の`createTempHoldReservation`（Phase 2実装済み）と同様の空き判定・価格計算ロジックを再利用するが、`status`は最初から`"confirmed"`、`source`は`"phone"`、`memberId`は呼び出し時点で既知（既存会員検索済み）とする。`isSlotFree`・`resolveCourseCampaigns`・`calculateReservationTotal`・`calculateCancellationDeadline`（いずれもPhase 2/5で実装済み）を再利用し、独自ロジックを書かないこと。

- [x] **Step 1: 失敗するテストを書く**

`app/actions/create-phone-reservation.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPhoneReservation } from "./create-phone-reservation";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findMany: vi.fn(), create: vi.fn() },
    course: { findUniqueOrThrow: vi.fn() },
    option: { findMany: vi.fn() },
    staff: { findUniqueOrThrow: vi.fn() },
  },
}));

const baseCourse = {
  id: 10,
  price: 10000,
  treatmentTimeMin: 60,
  campaignTargets: [],
  category: { campaignTargets: [] },
};

describe("createPhoneReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue(baseCourse as never);
    vi.mocked(prisma.option.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reservation.create).mockResolvedValue({ id: 200 } as never);
  });

  it("creates a confirmed phone reservation for a known member", async () => {
    const result = await createPhoneReservation({
      memberId: 5,
      storeId: 1,
      staffId: null,
      courseId: 10,
      optionIds: [],
      reservationDate: "2026-09-20",
      startMinutes: 660,
    });

    expect(result).toEqual({ status: "created", reservationId: 200 });
    const createArgs = vi.mocked(prisma.reservation.create).mock.calls[0][0];
    expect(createArgs.data.memberId).toBe(5);
    expect(createArgs.data.status).toBe("confirmed");
    expect(createArgs.data.source).toBe("phone");
    expect(createArgs.data.totalPrice).toBe(10000);
    expect(createArgs.data.tempHoldExpiresAt).toBeNull();
  });

  it("refuses to create when the slot is no longer free", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      { startTime: new Date("1970-01-01T11:00:00Z"), endTime: new Date("1970-01-01T12:00:00Z") },
    ] as never);

    const result = await createPhoneReservation({
      memberId: 5,
      storeId: 1,
      staffId: null,
      courseId: 10,
      optionIds: [],
      reservationDate: "2026-09-20",
      startMinutes: 660,
    });

    expect(result).toEqual({ status: "slot_unavailable" });
    expect(prisma.reservation.create).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/create-phone-reservation.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/create-phone-reservation.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";
import { dbTimeToMinutes, minutesToLabel } from "@/lib/reservation/time";
import { isSlotFree } from "@/lib/reservation/slot-conflict";
import { calculateReservationTotal } from "@/lib/reservation/total-price";
import { calculateCancellationDeadline } from "@/lib/reservation/cancellation-deadline";
import { resolveCourseCampaigns } from "./course-campaigns";

export interface CreatePhoneReservationParams {
  memberId: number;
  storeId: number;
  staffId: number | null;
  courseId: number;
  optionIds: number[];
  reservationDate: string;
  startMinutes: number;
}

export type CreatePhoneReservationResult =
  | { status: "created"; reservationId: number }
  | { status: "slot_unavailable" };

export async function createPhoneReservation(
  params: CreatePhoneReservationParams,
): Promise<CreatePhoneReservationResult> {
  const [course, options, staff] = await Promise.all([
    prisma.course.findUniqueOrThrow({
      where: { id: params.courseId },
      include: {
        campaignTargets: { include: { campaign: true } },
        category: { include: { campaignTargets: { include: { campaign: true } } } },
      },
    }),
    prisma.option.findMany({ where: { id: { in: params.optionIds } } }),
    params.staffId
      ? prisma.staff.findUniqueOrThrow({ where: { id: params.staffId } })
      : Promise.resolve(null),
  ]);

  const nominationFee = staff?.nominationFee ?? 0;

  const totalDuration =
    course.treatmentTimeMin + options.reduce((sum, o) => sum + o.durationMin, 0);
  const endMinutes = params.startMinutes + totalDuration;

  const targetDate = new Date(`${params.reservationDate}T00:00:00.000Z`);

  const existing = await prisma.reservation.findMany({
    where: {
      storeId: params.storeId,
      reservationDate: targetDate,
      status: { in: ["temp_hold", "confirmed"] },
      ...(params.staffId ? { staffId: params.staffId } : {}),
    },
  });

  const existingBookings = existing.map((r) => ({
    startMinutes: dbTimeToMinutes(r.startTime),
    endMinutes: dbTimeToMinutes(r.endTime),
  }));

  if (!isSlotFree(params.startMinutes, endMinutes, existingBookings)) {
    return { status: "slot_unavailable" };
  }

  const now = new Date();
  const activeCourseCampaigns = resolveCourseCampaigns(course, params.storeId, now);

  const pricing = calculateReservationTotal({
    course: { price: course.price, discountExempt: false, applicableCampaigns: activeCourseCampaigns },
    options: options.map((o) => ({
      price: o.price,
      discountExempt: o.discountExempt,
      applicableCampaigns: [],
    })),
    nominationFee,
  });

  const startLabel = minutesToLabel(params.startMinutes);
  const endLabel = minutesToLabel(endMinutes);

  const reservation = await prisma.reservation.create({
    data: {
      memberId: params.memberId,
      storeId: params.storeId,
      staffId: params.staffId,
      reservationDate: targetDate,
      startTime: new Date(`1970-01-01T${startLabel}:00.000Z`),
      endTime: new Date(`1970-01-01T${endLabel}:00.000Z`),
      status: "confirmed",
      source: "phone",
      nominationFeeApplied: nominationFee,
      totalPrice: pricing.totalPrice,
      tempHoldExpiresAt: null,
      cancellationDeadline: calculateCancellationDeadline(targetDate),
      items: {
        create: [
          {
            itemType: "course" as const,
            courseId: course.id,
            appliedCampaignId: pricing.course.appliedCampaignId,
            priceAtBooking: pricing.course.finalPrice,
          },
          ...pricing.options.map((o, idx) => ({
            itemType: "option" as const,
            optionId: options[idx].id,
            appliedCampaignId: o.appliedCampaignId,
            priceAtBooking: o.finalPrice,
          })),
        ],
      },
    },
  });

  return { status: "created", reservationId: reservation.id };
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/create-phone-reservation.test.ts
```

Expected: PASS（2 tests）

- [x] **Step 5: 型チェックと全テストスイートを実行する**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: 全122+4+2=128テストがパスする

- [x] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 3: 予約詳細ページUI（軽量検証）

**Files:**
- Create: `app/admin/(dashboard)/reservations/[id]/page.tsx`

- [x] **Step 1: 実装する**

`app/admin/(dashboard)/reservations/[id]/page.tsx`:

```tsx
"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getReservationDetail,
  cancelReservation,
  markNoShow,
  type ReservationDetail,
} from "@/app/actions/reservation-detail";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function statusLabel(status: string): string {
  switch (status) {
    case "temp_hold":
      return "仮予約";
    case "confirmed":
      return "確定";
    case "completed":
      return "来店済み";
    case "cancelled":
      return "キャンセル";
    case "no_show":
      return "無断キャンセル";
    default:
      return status;
  }
}

export default function AdminReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    getReservationDetail(Number(id)).then(setReservation);
  }, [id]);

  async function handleCancel() {
    setProcessing(true);
    await cancelReservation(Number(id));
    setProcessing(false);
    router.push("/admin/calendar");
  }

  async function handleNoShow() {
    setProcessing(true);
    await markNoShow(Number(id));
    setProcessing(false);
    router.push("/admin/calendar");
  }

  if (!reservation) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }

  const canOperate = reservation.status === "confirmed" || reservation.status === "temp_hold";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-2xl text-primary-700">予約詳細 #{reservation.id}</h1>
        <span className="rounded-full bg-primary-50 px-2 py-1 text-xs text-primary-700">
          {statusLabel(reservation.status)}
        </span>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
        <p className="text-sm text-neutral-800">
          <span className="text-neutral-500">会員：</span>
          {reservation.memberName ?? "—"}（{reservation.memberPhone ?? "—"}）
        </p>
        <p className="text-sm text-neutral-800">
          <span className="text-neutral-500">店舗：</span>
          {reservation.storeName}
        </p>
        <p className="text-sm text-neutral-800">
          <span className="text-neutral-500">日時：</span>
          {reservation.reservationDate} {reservation.startTimeLabel}〜
          {reservation.endTimeLabel}
        </p>
        <p className="text-sm text-neutral-800">
          <span className="text-neutral-500">コース：</span>
          {reservation.courseName || "（明細なし）"}
        </p>
        {reservation.optionNames.length > 0 && (
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">オプション：</span>
            {reservation.optionNames.join("、")}
          </p>
        )}
        <p className="text-sm text-neutral-800">
          <span className="text-neutral-500">担当：</span>
          {reservation.staffName ?? "指名なし"}
        </p>
        <p className="text-sm text-neutral-800">
          <span className="text-neutral-500">経路：</span>
          {reservation.source === "web" ? "WEB予約" : "電話予約"}
        </p>
        <p className="mt-2 text-lg font-medium text-neutral-800">
          合計 {formatYen(reservation.totalPrice)}
        </p>
      </div>

      {canOperate && (
        <div className="flex gap-3">
          <button
            type="button"
            disabled={processing}
            onClick={handleCancel}
            className="h-10 rounded-lg border border-error px-4 text-sm text-error disabled:opacity-50"
          >
            キャンセルする
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={handleNoShow}
            className="h-10 rounded-lg border border-neutral-300 px-4 text-sm text-neutral-700 disabled:opacity-50"
          >
            無断キャンセル（No-show）登録
          </button>
        </div>
      )}
    </div>
  );
}
```

- [x] **Step 2: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [x] **Step 3: 変更ファイルを報告する（コミットしない）**

---

## Task 4: 電話予約登録ページUI（軽量検証）

**Files:**
- Create: `app/admin/(dashboard)/reservations/new/page.tsx`

**注記:** 会員検索は既存の`searchCustomers`（Phase 7実装済み）を再利用する。コース選択は簡易化し、カテゴリを介さず全カテゴリのコースを一括取得できるよう`listCourseCategories`＋`listCoursesForCategory`を順に呼び出す（カテゴリ選択→コース選択の2段階UIとする）。日時選択は`getAvailableSlots`（Phase 2実装済み）を再利用する。

- [x] **Step 1: 実装する**

`app/admin/(dashboard)/reservations/new/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { searchCustomers, type CustomerListItem } from "@/app/actions/search-customers";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { listCourseCategories, type CourseCategoryListItem } from "@/app/actions/course-categories";
import { listCoursesForCategory, type CourseListItem } from "@/app/actions/courses";
import { listStaffForStore, type StaffListItem } from "@/app/actions/staff";
import { getAvailableSlots } from "@/app/actions/availability";
import { createPhoneReservation } from "@/app/actions/create-phone-reservation";
import { minutesToLabel } from "@/lib/reservation/time";

export default function AdminNewPhoneReservationPage() {
  const router = useRouter();
  const [memberQuery, setMemberQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [memberId, setMemberId] = useState<number | null>(null);

  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);

  const [categories, setCategories] = useState<CourseCategoryListItem[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [courseId, setCourseId] = useState<number | null>(null);

  const [staff, setStaff] = useState<StaffListItem[]>([]);
  const [staffId, setStaffId] = useState<number | null>(null);

  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<number[]>([]);
  const [startMinutes, setStartMinutes] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (memberQuery.length < 1) {
      setCustomers([]);
      return;
    }
    searchCustomers({ name: memberQuery }).then(setCustomers);
  }, [memberQuery]);

  useEffect(() => {
    listStores().then(setStores);
    listCourseCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (categoryId !== null && storeId !== null) {
      listCoursesForCategory(categoryId, storeId).then(setCourses);
    }
  }, [categoryId, storeId]);

  useEffect(() => {
    if (storeId !== null) {
      listStaffForStore(storeId).then(setStaff);
    }
  }, [storeId]);

  useEffect(() => {
    if (storeId !== null && courseId !== null && date) {
      getAvailableSlots({ storeId, staffId, date, courseId, optionIds: [] }).then(setSlots);
    }
  }, [storeId, courseId, staffId, date]);

  async function handleSubmit() {
    if (memberId === null || storeId === null || courseId === null || startMinutes === null) {
      setError("会員・店舗・コース・日時をすべて選択してください。");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await createPhoneReservation({
      memberId,
      storeId,
      staffId,
      courseId,
      optionIds: [],
      reservationDate: date,
      startMinutes,
    });
    setSubmitting(false);

    if (result.status === "slot_unavailable") {
      setError("選択した時間枠は既に埋まっています。別の時間を選んでください。");
      return;
    }

    router.push(`/admin/reservations/${result.reservationId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">電話予約の新規登録</h1>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-neutral-600">会員を検索</label>
        <input
          type="text"
          placeholder="氏名で検索"
          value={memberQuery}
          onChange={(e) => setMemberQuery(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />
        {customers.length > 0 && (
          <ul className="rounded-md border border-neutral-200">
            {customers.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setMemberId(c.id);
                    setMemberQuery(c.name);
                    setCustomers([]);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {memberId !== null && (
          <p className="text-xs text-primary-700">選択中の会員ID: {memberId}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-neutral-600">店舗</label>
        <select
          value={storeId ?? ""}
          onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          <option value="">選択してください</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-neutral-600">コースカテゴリ</label>
        <select
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          <option value="">選択してください</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-neutral-600">コース</label>
        <select
          value={courseId ?? ""}
          onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          <option value="">選択してください</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-neutral-600">スタッフ（任意）</label>
        <select
          value={staffId ?? ""}
          onChange={(e) => setStaffId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          <option value="">指名なし</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-neutral-600">日付</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />
      </div>

      {slots.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {slots.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setStartMinutes(slot)}
              className={`rounded-md border px-2 py-2 text-sm ${
                startMinutes === slot
                  ? "border-primary-500 bg-primary-500 text-white"
                  : "border-neutral-200 text-neutral-700"
              }`}
            >
              {minutesToLabel(slot)}
            </button>
          ))}
        </div>
      )}

      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}

      <button
        type="button"
        disabled={submitting}
        onClick={handleSubmit}
        className="h-12 rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
      >
        予約を登録する
      </button>
    </div>
  );
}
```

- [x] **Step 2: サイドバーに「電話予約登録」リンクを追加する**

`app/admin/(dashboard)/layout.tsx`の`<nav>`内、「ステータス設定」リンクの後に以下を追加する:

```tsx
          <Link
            href="/admin/reservations/new"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            電話予約登録
          </Link>
```

- [x] **Step 3: 予約カレンダーの各予約ブロックから詳細ページへ遷移できるようにする**

`app/admin/(dashboard)/calendar/page.tsx`の予約ブロック（`<div key={r.id} className="flex items-center justify-between ...">`）を、`Link`でラップして`/admin/reservations/${r.id}`へ遷移できるようにする。ファイル冒頭に`import Link from "next/link";`を追加し、該当`<div>`を以下のように`<Link>`に置き換える:

```tsx
                <Link
                  key={r.id}
                  href={`/admin/reservations/${r.id}`}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-0 p-3 shadow-sm hover:border-primary-300"
                >
```

（閉じタグも`</div>`から`</Link>`に変更する）

- [x] **Step 4: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [x] **Step 5: 全テストスイートを実行する**

```bash
npx vitest run
```

Expected: 全128テストがパスする（新規UIファイルはテスト無し）

- [x] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## 完了確認チェックリスト

- [x] `npx vitest run` の全テストがパスする
- [x] `npx tsc --noEmit` がエラーなく通る
- [x] `npx eslint .` がエラーなく通る
- [x] `/admin/calendar`から予約ブロックをクリックして詳細ページへ遷移できることを確認する
- [x] `/admin/reservations/new`で会員検索→店舗→カテゴリ→コース→日時選択→登録の流れが動作することを確認する（`npm run dev`はこのサンドボックスでは起動確認できないため、ユーザーのターミナルで確認する）
