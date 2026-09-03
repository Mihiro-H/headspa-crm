# フォレスパ Phase 6: 管理画面 第1弾（ログイン・ダッシュボード・予約カレンダー） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 管理画面のA-01（管理者ログイン）・A-02（ダッシュボード）・A-03（予約カレンダー、読み取り専用）を実装する。あわせて、予約作成時にコース／オプション明細（`ReservationItem`）が保存されていなかったギャップを修正する（カレンダーで「何の予約か」を表示するために必須）。

**Architecture:** `app/admin/`配下にNext.js App Routerのルートグループを使い、ログイン画面（サイドバー無し）とダッシュボード/カレンダー（共通サイドバーレイアウト）を分離する。管理者認証はPhase 0実装済みの`admin-credentials`プロバイダとルート保護ミドルウェアをそのまま使う。

**Tech Stack:** Next.js App Router / TypeScript / Tailwind v4 / Auth.js v5（既存Phase 0〜5基盤を使用）

**参照元資料:** `02_screenspecification.md`（A-01・A-02・A-03節）、`01_designtokens.md`（サイドナビ仕様）

**このPhaseで作らないもの（Phase 7以降）:** 顧客管理（A-05・A-06・A-07）、予約詳細・電話予約登録（A-04）、ドラッグ&ドロップでの予約変更、右クリック/長押しメニュー、店舗別の管理者権限スコープ制御（本Phaseでは全管理者が店舗セレクタで任意の店舗を閲覧できる簡易実装とする）。

> **実行環境に関する注記（継承）:** `.git`書き込み不可（コミットは後回し）、`.env`系ファイル読み書き不可、`npm run build`/`npm run dev`は不安定（`tsc --noEmit`/`eslint`/`vitest`を使う）。UIコンポーネントは軽量検証（tsc/eslintのみ）、データ取得系Server ActionsはTDD、という前Phaseの方針を踏襲する。

---

## Task 1: 予約明細（ReservationItem）永続化の修正（TDD）

**Files:**
- Modify: `app/actions/create-temp-hold.ts`
- Modify: `app/actions/create-temp-hold.test.ts`

**背景:** `createTempHoldReservation`は予約の合計金額（`totalPrice`）だけを保存し、どのコース・オプションが選ばれたかを示す`ReservationItem`レコードを一切作成していなかった。このため、予約カレンダーや後の顧客詳細・レポート画面で「何の予約か」を表示する手段がない。本タスクで`reservation.items`をネストして作成するよう修正する。

- [x] **Step 1: 失敗するテストを書く（既存テストファイルに追記）**

`app/actions/create-temp-hold.test.ts`の`describe`ブロック内、既存のテストの後に追加する:

```typescript
  it("creates course and option line items alongside the reservation", async () => {
    vi.mocked(prisma.option.findMany).mockResolvedValue([
      { id: 20, price: 1500, durationMin: 15, discountExempt: true },
    ] as never);

    await createTempHoldReservation({
      storeId: 1,
      staffId: null,
      courseId: 10,
      optionIds: [20],
      reservationDate: "2026-09-10",
      startMinutes: 660,
    });

    const createArgs = vi.mocked(prisma.reservation.create).mock.calls[0][0];
    expect(createArgs.data.items.create).toEqual([
      { itemType: "course", courseId: 10, appliedCampaignId: null, priceAtBooking: 10000 },
      { itemType: "option", optionId: 20, appliedCampaignId: null, priceAtBooking: 1500 },
    ]);
  });
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/create-temp-hold.test.ts
```

Expected: FAIL（`createArgs.data.items`が`undefined`）

- [x] **Step 3: 実装する**

`app/actions/create-temp-hold.ts`の`prisma.reservation.create({ data: { ... } })`の`data`オブジェクトに、`cancellationDeadline: ...,`の行の直後（`}`の直前）に以下を追加する:

```typescript
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
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/create-temp-hold.test.ts
```

Expected: PASS（5 tests）

- [x] **Step 5: 型チェックと全テストスイートを実行する**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: 全111+1=112テストがパスする

- [x] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 2: 管理者ログインページ（軽量検証）

**Files:**
- Create: `app/admin/login/page.tsx`

**注記:** `signIn("admin-credentials", ...)`はPhase 0実装済みの管理者用Credentials Providerを使う。ログイン成功後は`/admin/dashboard`へ遷移する。

- [x] **Step 1: 実装する**

`app/admin/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await signIn("admin-credentials", { email, password, redirect: false });
    setSubmitting(false);
    if (result?.ok) {
      router.push("/admin/dashboard");
    } else {
      setError("メールアドレスまたはパスワードが正しくありません。");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
      <h1 className="font-heading text-2xl text-primary-700">フォレスパ 管理画面</h1>
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
      <input
        type="email"
        placeholder="メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-12 rounded-md border border-neutral-300 px-3"
      />
      <input
        type="password"
        placeholder="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-12 rounded-md border border-neutral-300 px-3"
      />
      <button
        type="button"
        disabled={submitting}
        onClick={handleSubmit}
        className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
      >
        ログイン
      </button>
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

## Task 3: 管理画面レイアウト（サイドバー、軽量検証）

**Files:**
- Create: `app/admin/(dashboard)/layout.tsx`

**注記:** Next.jsのルートグループ`(dashboard)`を使い、ログインページ（`app/admin/login/`）にはこのサイドバーレイアウトが適用されないようにする（ルートグループはURLパスに影響しない：`app/admin/(dashboard)/dashboard/page.tsx`は`/admin/dashboard`に解決される）。サイドバー幅240pxはデザイントークン定義書の仕様通り。

- [x] **Step 1: 実装する**

`app/admin/(dashboard)/layout.tsx`:

```tsx
import Link from "next/link";

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-neutral-200 bg-neutral-0 p-4">
        <h1 className="font-heading text-lg text-primary-700">フォレスパ</h1>
        <nav className="mt-6 flex flex-col gap-1">
          <Link
            href="/admin/dashboard"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            ダッシュボード
          </Link>
          <Link
            href="/admin/calendar"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            予約カレンダー
          </Link>
        </nav>
      </aside>
      <main className="flex-1 bg-neutral-50 p-6">{children}</main>
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

## Task 4: ダッシュボードデータ取得Server Action（TDD）

**Files:**
- Create: `app/actions/dashboard-summary.ts`
- Test: `app/actions/dashboard-summary.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`app/actions/dashboard-summary.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDashboardSummary } from "./dashboard-summary";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findMany: vi.fn() },
  },
}));

const today = new Date("2026-09-15T00:00:00Z");

describe("getDashboardSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts today's confirmed/completed reservations and sums their price", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      { totalPrice: 8000 },
      { totalPrice: 12000 },
    ] as never);

    const result = await getDashboardSummary(1, today);

    expect(result).toEqual({ todayReservationCount: 2, todaySalesTotal: 20000 });
    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: {
        reservationDate: today,
        status: { in: ["confirmed", "completed"] },
        storeId: 1,
      },
    });
  });

  it("omits the store filter when storeId is null (all stores)", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);

    await getDashboardSummary(null, today);

    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: {
        reservationDate: today,
        status: { in: ["confirmed", "completed"] },
      },
    });
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/dashboard-summary.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/dashboard-summary.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";

export interface DashboardSummary {
  todayReservationCount: number;
  todaySalesTotal: number;
}

export async function getDashboardSummary(
  storeId: number | null,
  today: Date = new Date(),
): Promise<DashboardSummary> {
  const reservations = await prisma.reservation.findMany({
    where: {
      reservationDate: today,
      status: { in: ["confirmed", "completed"] },
      ...(storeId ? { storeId } : {}),
    },
  });

  return {
    todayReservationCount: reservations.length,
    todaySalesTotal: reservations.reduce((sum, r) => sum + r.totalPrice, 0),
  };
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/dashboard-summary.test.ts
```

Expected: PASS（2 tests）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 5: ダッシュボードUI（軽量検証）

**Files:**
- Create: `app/admin/(dashboard)/dashboard/page.tsx`

**注記:** 店舗切り替えは既存の`listStores`（`app/actions/stores.ts`、Phase 3実装済み）を再利用する。

- [x] **Step 1: 実装する**

`app/admin/(dashboard)/dashboard/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { getDashboardSummary, type DashboardSummary } from "@/app/actions/dashboard-summary";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export default function AdminDashboardPage() {
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    listStores().then(setStores);
  }, []);

  useEffect(() => {
    getDashboardSummary(storeId).then(setSummary);
  }, [storeId]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-primary-700">ダッシュボード</h1>
        <select
          value={storeId ?? ""}
          onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          <option value="">全店舗</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-6 shadow-sm">
          <p className="text-sm text-neutral-500">本日の予約件数</p>
          <p className="mt-2 text-3xl font-medium text-neutral-800">
            {summary?.todayReservationCount ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-6 shadow-sm">
          <p className="text-sm text-neutral-500">本日の売上速報</p>
          <p className="mt-2 text-3xl font-medium text-neutral-800">
            {summary ? formatYen(summary.todaySalesTotal) : "—"}
          </p>
        </div>
      </div>
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

## Task 6: 予約カレンダーデータ取得Server Action（TDD）

**Files:**
- Create: `app/actions/calendar-reservations.ts`
- Test: `app/actions/calendar-reservations.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`app/actions/calendar-reservations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCalendarReservations } from "./calendar-reservations";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findMany: vi.fn() },
  },
}));

describe("getCalendarReservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps reservations with staff/member/course names for calendar display", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      {
        id: 1,
        staffId: 3,
        staff: { name: "田中 花子" },
        member: { name: "佐藤 太郎" },
        startTime: new Date("1970-01-01T11:00:00Z"),
        endTime: new Date("1970-01-01T12:00:00Z"),
        status: "confirmed",
        source: "web",
        items: [{ itemType: "course", course: { name: "スタンダード" } }],
      },
      {
        id: 2,
        staffId: null,
        staff: null,
        member: null,
        startTime: new Date("1970-01-01T14:00:00Z"),
        endTime: new Date("1970-01-01T15:00:00Z"),
        status: "temp_hold",
        source: "web",
        items: [],
      },
    ] as never);

    const result = await getCalendarReservations(1, "2026-09-15");

    expect(result).toEqual([
      {
        id: 1,
        staffId: 3,
        staffName: "田中 花子",
        memberName: "佐藤 太郎",
        courseName: "スタンダード",
        startMinutes: 660,
        endMinutes: 720,
        status: "confirmed",
        source: "web",
      },
      {
        id: 2,
        staffId: null,
        staffName: null,
        memberName: null,
        courseName: "",
        startMinutes: 840,
        endMinutes: 900,
        status: "temp_hold",
        source: "web",
      },
    ]);
    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: {
        storeId: 1,
        reservationDate: new Date("2026-09-15T00:00:00.000Z"),
        status: { in: ["temp_hold", "confirmed", "completed"] },
      },
      include: {
        staff: true,
        member: true,
        items: { include: { course: true } },
      },
      orderBy: { startTime: "asc" },
    });
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/calendar-reservations.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/calendar-reservations.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";
import { dbTimeToMinutes } from "@/lib/reservation/time";

export interface CalendarReservation {
  id: number;
  staffId: number | null;
  staffName: string | null;
  memberName: string | null;
  courseName: string;
  startMinutes: number;
  endMinutes: number;
  status: string;
  source: string;
}

export async function getCalendarReservations(
  storeId: number,
  date: string,
): Promise<CalendarReservation[]> {
  const targetDate = new Date(`${date}T00:00:00.000Z`);

  const reservations = await prisma.reservation.findMany({
    where: {
      storeId,
      reservationDate: targetDate,
      status: { in: ["temp_hold", "confirmed", "completed"] },
    },
    include: {
      staff: true,
      member: true,
      items: { include: { course: true } },
    },
    orderBy: { startTime: "asc" },
  });

  return reservations.map((r) => {
    const courseItem = r.items.find((i) => i.itemType === "course");
    return {
      id: r.id,
      staffId: r.staffId,
      staffName: r.staff?.name ?? null,
      memberName: r.member?.name ?? null,
      courseName: courseItem?.course?.name ?? "",
      startMinutes: dbTimeToMinutes(r.startTime),
      endMinutes: dbTimeToMinutes(r.endTime),
      status: r.status,
      source: r.source,
    };
  });
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/calendar-reservations.test.ts
```

Expected: PASS（1 test）

- [x] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [x] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 7: 予約カレンダーUI（軽量検証）

**Files:**
- Create: `app/admin/(dashboard)/calendar/page.tsx`

**注記:** ピクセル単位のタイムライン表示ではなく、スタッフごとにグループ化したリスト表示とする（軽量な最初の実装。タイムライングリッド表示は将来のフォローアップとする）。

- [x] **Step 1: 実装する**

`app/admin/(dashboard)/calendar/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import {
  getCalendarReservations,
  type CalendarReservation,
} from "@/app/actions/calendar-reservations";
import { minutesToLabel } from "@/lib/reservation/time";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusLabel(status: string): string {
  switch (status) {
    case "temp_hold":
      return "仮予約";
    case "confirmed":
      return "確定";
    case "completed":
      return "来店済み";
    default:
      return status;
  }
}

export default function AdminCalendarPage() {
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const [reservations, setReservations] = useState<CalendarReservation[]>([]);

  useEffect(() => {
    listStores().then((list) => {
      setStores(list);
      if (list.length > 0) setStoreId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (storeId === null) return;
    getCalendarReservations(storeId, date).then(setReservations);
  }, [storeId, date]);

  const grouped = reservations.reduce<Record<string, CalendarReservation[]>>((acc, r) => {
    const key = r.staffName ?? "指名なし";
    acc[key] = acc[key] ?? [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-heading text-2xl text-primary-700">予約カレンダー</h1>
        <select
          value={storeId ?? ""}
          onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />
      </div>

      {Object.keys(grouped).length === 0 && (
        <p className="text-sm text-neutral-500">この日の予約はありません。</p>
      )}

      <div className="flex flex-col gap-6">
        {Object.entries(grouped).map(([staffName, items]) => (
          <div key={staffName}>
            <h2 className="mb-2 text-sm font-medium text-neutral-600">{staffName}</h2>
            <div className="flex flex-col gap-2">
              {items.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-0 p-3 shadow-sm"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-800">
                      {minutesToLabel(r.startMinutes)}〜{minutesToLabel(r.endMinutes)}　
                      {r.courseName || "（明細なし）"}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {r.memberName ?? "（未確定）"}　
                      {r.source === "web" ? "WEB予約" : "電話予約"}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary-50 px-2 py-1 text-xs text-primary-700">
                    {statusLabel(r.status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [x] **Step 2: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [x] **Step 3: 全テストスイートを実行する**

```bash
npx vitest run
```

Expected: 全112テスト（Task1）＋新規3テスト（Task4, 6）＝115テストがパスする

- [x] **Step 4: 変更ファイルを報告する（コミットしない）**

---

## 完了確認チェックリスト

- [x] `npx vitest run` の全テストがパスする
- [x] `npx tsc --noEmit` がエラーなく通る
- [x] `npx eslint .` がエラーなく通る
- [x] `/admin/login`でログインし、`/admin/dashboard`・`/admin/calendar`が表示されることをユーザーがブラウザで確認する（`npm run dev`はこのサンドボックスでは起動確認できないため、ユーザーのターミナルで確認する）
- [x] `/reserve`で新しく予約を作成し、`/admin/calendar`にコース名付きで表示されることを確認する（Task1のReservationItem修正の動作確認）
