# 売上・月報レポート（A-08）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面に売上・月報レポート画面（A-08）を実装する。期間・店舗で絞り込んだ売上サマリー、日別／メニュー別／スタッフ別の内訳、明細一覧、CSV（Excelで開ける形式）ダウンロードを提供する。

**Architecture:** 既存の`app/actions/`パターンに従い、単一のServer Action `getSalesReport` が期間・店舗フィルタを受け取り、集計済みのレポートデータをまとめて返す。UIは`app/admin/(dashboard)/`配下の他の管理画面と同じくクライアントコンポーネントで表示する。

**Tech Stack:** Next.js 16 App Router / TypeScript / Prisma / Vitest

**参照元資料:** `02_screenspecification.md`（画面仕様書 A-08節）、`04_table-design.md`（reservations・reservation_itemsテーブル）

---

## 実行環境に関する注記（継承）

- `.git`への書き込み（`git add`/`git commit`含む）は一切実行できない。ユーザーが自分のターミナルで実行する。
- `.env`/`.env.*`は読み取り・書き込みともに不可。
- `npm run build`・`npm run dev`はこのサンドボックスでは不安定なため実行しない。検証は`npx tsc --noEmit`・`npx eslint .`・`npx vitest run`で行う。
- **CRITICAL: 仕様にある関数・ロジックを自己判断で別実装に置き換えない。** もし仕様通りに実装できないと判断した場合は、黙って別実装にせず、範囲を絞った`// eslint-disable-next-line`＋理由コメント、またはDONE_WITH_CONCERNSとして報告すること。

---

## スコープ決定事項（このPhaseで意図的に簡略化した点）

1. **「Excelダウンロード」→ CSVダウンロードとして実装する**：`.xlsx`バイナリを生成するには新規npm依存（exceljs等）の追加が必要になる。このプロジェクトはこれまでチャート・帳票系ライブラリを一切使っていないため、新規依存を増やさずに済むCSV（UTF-8 BOM付き。Excelでそのまま開ける）で代替する。列構成は明細テーブルと同一とする。
2. **グラフ→ 簡易バー表示として実装する**：「日別売上推移（折れ線）」「メニュー別売上構成（円グラフ）」「スタッフ別売上（棒グラフ）」はいずれも、チャートライブラリを新規導入せず、CSS幅で表現する横棒リストとして実装する（このプロジェクトに既存のチャートライブラリはないため）。
3. **「客数」＝期間内の予約件数**とする（予約1件＝来店1回とみなす。ユニーク会員数ではない）。
4. **「新規／リピート」は期間内に登場したユニーク会員単位で判定する**：その会員の全履歴（confirmed/completedステータス）の中で最も古い予約日が、レポート期間の開始日以降であれば「新規」、それより前であれば「リピート」とする。
5. **集計対象ステータスは`confirmed`・`completed`**とする（ダッシュボード集計 `getDashboardSummary` と同じ扱い。`temp_hold`・`cancelled`・`no_show`は除外）。

---

## Task 1: 売上レポートServer Action（TDD）

**Files:**
- Create: `app/actions/sales-report.ts`
- Test: `app/actions/sales-report.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/sales-report.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSalesReport } from "./sales-report";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { findMany: vi.fn() },
  },
}));

describe("getSalesReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes summary, daily/course/staff breakdowns, and detail rows for the period", async () => {
    const reservations = [
      {
        id: 1,
        reservationDate: new Date("2026-09-05T00:00:00.000Z"),
        totalPrice: 10000,
        staffId: 5,
        memberId: 10,
        store: { name: "フォレスパ 渋谷店" },
        member: { name: "山田太郎" },
        staff: { name: "佐藤 由紀" },
        items: [
          { itemType: "course", course: { name: "頭皮ケアスタンダード" }, priceAtBooking: 10000 },
        ],
      },
      {
        id: 2,
        reservationDate: new Date("2026-09-05T00:00:00.000Z"),
        totalPrice: 8000,
        staffId: null,
        memberId: 20,
        store: { name: "フォレスパ 渋谷店" },
        member: { name: "鈴木花子" },
        staff: null,
        items: [
          { itemType: "course", course: { name: "頭皮ケアプレミアム" }, priceAtBooking: 8000 },
        ],
      },
      {
        id: 3,
        reservationDate: new Date("2026-09-10T00:00:00.000Z"),
        totalPrice: 12000,
        staffId: 5,
        memberId: 10,
        store: { name: "フォレスパ 渋谷店" },
        member: { name: "山田太郎" },
        staff: { name: "佐藤 由紀" },
        items: [
          { itemType: "course", course: { name: "頭皮ケアスタンダード" }, priceAtBooking: 12000 },
        ],
      },
    ];
    const earliestPerMember = [
      { memberId: 10, reservationDate: new Date("2026-08-01T00:00:00.000Z") },
      { memberId: 20, reservationDate: new Date("2026-09-05T00:00:00.000Z") },
    ];

    vi.mocked(prisma.reservation.findMany)
      .mockResolvedValueOnce(reservations as never)
      .mockResolvedValueOnce(earliestPerMember as never);

    const result = await getSalesReport({
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      storeId: null,
    });

    expect(result.summary).toEqual({
      salesTotal: 30000,
      customerCount: 3,
      averageSpend: 10000,
      newCustomerCount: 1,
      repeatCustomerCount: 1,
      nominationSalesRatio: 73,
    });

    expect(result.dailySales).toEqual([
      { date: "2026-09-05", total: 18000 },
      { date: "2026-09-10", total: 12000 },
    ]);

    expect(result.courseSales).toEqual([
      { courseName: "頭皮ケアスタンダード", total: 22000 },
      { courseName: "頭皮ケアプレミアム", total: 8000 },
    ]);

    expect(result.staffSales).toEqual([
      { staffName: "佐藤 由紀", total: 22000 },
      { staffName: "指名なし", total: 8000 },
    ]);

    expect(result.details).toEqual([
      {
        id: 1,
        date: "2026-09-05",
        storeName: "フォレスパ 渋谷店",
        memberName: "山田太郎",
        courseName: "頭皮ケアスタンダード",
        staffName: "佐藤 由紀",
        totalPrice: 10000,
      },
      {
        id: 2,
        date: "2026-09-05",
        storeName: "フォレスパ 渋谷店",
        memberName: "鈴木花子",
        courseName: "頭皮ケアプレミアム",
        staffName: null,
        totalPrice: 8000,
      },
      {
        id: 3,
        date: "2026-09-10",
        storeName: "フォレスパ 渋谷店",
        memberName: "山田太郎",
        courseName: "頭皮ケアスタンダード",
        staffName: "佐藤 由紀",
        totalPrice: 12000,
      },
    ]);
  });

  it("includes the store filter in the query when storeId is given", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);

    await getSalesReport({ startDate: "2026-09-01", endDate: "2026-09-30", storeId: 3 });

    expect(prisma.reservation.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        reservationDate: {
          gte: new Date("2026-09-01T00:00:00.000Z"),
          lte: new Date("2026-09-30T00:00:00.000Z"),
        },
        status: { in: ["confirmed", "completed"] },
        storeId: 3,
      },
      include: {
        store: true,
        member: true,
        staff: true,
        items: { include: { course: true } },
      },
      orderBy: { reservationDate: "asc" },
    });
  });

  it("omits the store filter when storeId is null (all stores)", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);

    await getSalesReport({ startDate: "2026-09-01", endDate: "2026-09-30", storeId: null });

    expect(prisma.reservation.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        reservationDate: {
          gte: new Date("2026-09-01T00:00:00.000Z"),
          lte: new Date("2026-09-30T00:00:00.000Z"),
        },
        status: { in: ["confirmed", "completed"] },
      },
      include: {
        store: true,
        member: true,
        staff: true,
        items: { include: { course: true } },
      },
      orderBy: { reservationDate: "asc" },
    });
  });

  it("returns zeroed summary and empty breakdowns when there are no reservations in the period", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);

    const result = await getSalesReport({
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      storeId: null,
    });

    expect(result.summary).toEqual({
      salesTotal: 0,
      customerCount: 0,
      averageSpend: 0,
      newCustomerCount: 0,
      repeatCustomerCount: 0,
      nominationSalesRatio: 0,
    });
    expect(result.dailySales).toEqual([]);
    expect(result.courseSales).toEqual([]);
    expect(result.staffSales).toEqual([]);
    expect(result.details).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run app/actions/sales-report.test.ts
```

Expected: FAIL（`sales-report.ts`が存在しない）

- [ ] **Step 3: 実装する**

`app/actions/sales-report.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";

const REVENUE_STATUSES = ["confirmed", "completed"] as const;

export interface SalesReportSummary {
  salesTotal: number;
  customerCount: number;
  averageSpend: number;
  newCustomerCount: number;
  repeatCustomerCount: number;
  nominationSalesRatio: number;
}

export interface DailySalesPoint {
  date: string;
  total: number;
}

export interface CourseSalesSlice {
  courseName: string;
  total: number;
}

export interface StaffSalesBar {
  staffName: string;
  total: number;
}

export interface SalesReportDetailRow {
  id: number;
  date: string;
  storeName: string;
  memberName: string;
  courseName: string;
  staffName: string | null;
  totalPrice: number;
}

export interface SalesReport {
  summary: SalesReportSummary;
  dailySales: DailySalesPoint[];
  courseSales: CourseSalesSlice[];
  staffSales: StaffSalesBar[];
  details: SalesReportDetailRow[];
}

export interface GetSalesReportParams {
  startDate: string;
  endDate: string;
  storeId: number | null;
}

export async function getSalesReport(params: GetSalesReportParams): Promise<SalesReport> {
  const start = new Date(`${params.startDate}T00:00:00.000Z`);
  const end = new Date(`${params.endDate}T00:00:00.000Z`);

  const reservations = await prisma.reservation.findMany({
    where: {
      reservationDate: { gte: start, lte: end },
      status: { in: [...REVENUE_STATUSES] },
      ...(params.storeId ? { storeId: params.storeId } : {}),
    },
    include: {
      store: true,
      member: true,
      staff: true,
      items: { include: { course: true } },
    },
    orderBy: { reservationDate: "asc" },
  });

  const salesTotal = reservations.reduce((sum, r) => sum + r.totalPrice, 0);
  const customerCount = reservations.length;
  const averageSpend = customerCount > 0 ? Math.round(salesTotal / customerCount) : 0;

  const nominatedTotal = reservations
    .filter((r) => r.staffId !== null)
    .reduce((sum, r) => sum + r.totalPrice, 0);
  const nominationSalesRatio =
    salesTotal > 0 ? Math.round((nominatedTotal / salesTotal) * 100) : 0;

  const memberIds = [
    ...new Set(reservations.map((r) => r.memberId).filter((id): id is number => id !== null)),
  ];
  const earliestReservations = await prisma.reservation.findMany({
    where: { memberId: { in: memberIds }, status: { in: [...REVENUE_STATUSES] } },
    orderBy: { reservationDate: "asc" },
    select: { memberId: true, reservationDate: true },
  });
  const earliestDateByMemberId = new Map<number, Date>();
  for (const r of earliestReservations) {
    if (r.memberId !== null && !earliestDateByMemberId.has(r.memberId)) {
      earliestDateByMemberId.set(r.memberId, r.reservationDate);
    }
  }
  const newCustomerCount = memberIds.filter((id) => {
    const earliest = earliestDateByMemberId.get(id);
    return earliest !== undefined && earliest >= start;
  }).length;
  const repeatCustomerCount = memberIds.length - newCustomerCount;

  const dailyMap = new Map<string, number>();
  for (const r of reservations) {
    const dateKey = r.reservationDate.toISOString().slice(0, 10);
    dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + r.totalPrice);
  }
  const dailySales = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));

  const courseMap = new Map<string, number>();
  for (const r of reservations) {
    for (const item of r.items) {
      if (item.itemType === "course" && item.course) {
        courseMap.set(
          item.course.name,
          (courseMap.get(item.course.name) ?? 0) + item.priceAtBooking,
        );
      }
    }
  }
  const courseSales = [...courseMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([courseName, total]) => ({ courseName, total }));

  const staffMap = new Map<string, number>();
  for (const r of reservations) {
    const staffName = r.staff?.name ?? "指名なし";
    staffMap.set(staffName, (staffMap.get(staffName) ?? 0) + r.totalPrice);
  }
  const staffSales = [...staffMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([staffName, total]) => ({ staffName, total }));

  const details = reservations.map((r) => ({
    id: r.id,
    date: r.reservationDate.toISOString().slice(0, 10),
    storeName: r.store.name,
    memberName: r.member?.name ?? "",
    courseName: r.items.find((i) => i.itemType === "course")?.course?.name ?? "",
    staffName: r.staff?.name ?? null,
    totalPrice: r.totalPrice,
  }));

  return {
    summary: {
      salesTotal,
      customerCount,
      averageSpend,
      newCustomerCount,
      repeatCustomerCount,
      nominationSalesRatio,
    },
    dailySales,
    courseSales,
    staffSales,
    details,
  };
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run app/actions/sales-report.test.ts
```

Expected: PASS（4 tests）

- [ ] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 2: 売上・月報レポート画面（軽量検証）

**Files:**
- Create: `app/admin/(dashboard)/reports/page.tsx`
- Modify: `app/admin/(dashboard)/layout.tsx`

- [ ] **Step 1: レポート画面を実装する**

`app/admin/(dashboard)/reports/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getSalesReport, type SalesReport } from "@/app/actions/sales-report";
import { listStores, type StoreListItem } from "@/app/actions/stores";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultStartDate(): string {
  const now = new Date();
  return toDateInputValue(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
}

function defaultEndDate(): string {
  return toDateInputValue(new Date());
}

function downloadCsv(details: SalesReport["details"], startDate: string, endDate: string) {
  const header = ["日付", "店舗", "会員名", "メニュー", "スタッフ", "金額"];
  const rows = details.map((d) => [
    d.date,
    d.storeName,
    d.memberName,
    d.courseName,
    d.staffName ?? "",
    String(d.totalPrice),
  ]);
  const csvBody = [header, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([`﻿${csvBody}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sales-report_${startDate}_${endDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function BarList({
  items,
}: {
  items: { label: string; total: number }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.total));
  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && <p className="text-sm text-neutral-500">データがありません。</p>}
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1">
          <div className="flex justify-between text-sm text-neutral-700">
            <span>{item.label}</span>
            <span>{item.total.toLocaleString()}円</span>
          </div>
          <div className="h-2 rounded-full bg-neutral-100">
            <div
              className="h-2 rounded-full bg-primary-500"
              style={{ width: `${Math.round((item.total / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SalesReportPage() {
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [storeId, setStoreId] = useState<number | null>(null);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listStores().then(setStores);
  }, []);

  async function handleSearch() {
    setLoading(true);
    const result = await getSalesReport({ startDate, endDate, storeId });
    setReport(result);
    setLoading(false);
  }

  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 初回のみデフォルト期間で読み込む。以降はhandleSearchボタン操作で明示的に再取得する
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">売上・月報レポート</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">開始日</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">終了日</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">店舗</label>
          <select
            value={storeId ?? ""}
            onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="">全店舗</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="h-10 rounded-lg bg-primary-500 px-4 font-medium text-white disabled:opacity-50"
        >
          表示を更新
        </button>
        {report && (
          <button
            type="button"
            onClick={() => downloadCsv(report.details, startDate, endDate)}
            className="h-10 rounded-lg border border-primary-500 px-4 font-medium text-primary-600"
          >
            Excelダウンロード（CSV）
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-neutral-500">読み込み中...</p>}

      {report && !loading && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4">
              <p className="text-xs text-neutral-500">売上合計</p>
              <p className="font-heading text-xl text-primary-700">
                {report.summary.salesTotal.toLocaleString()}円
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4">
              <p className="text-xs text-neutral-500">客数</p>
              <p className="font-heading text-xl text-primary-700">
                {report.summary.customerCount}件
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4">
              <p className="text-xs text-neutral-500">客単価</p>
              <p className="font-heading text-xl text-primary-700">
                {report.summary.averageSpend.toLocaleString()}円
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4">
              <p className="text-xs text-neutral-500">新規／リピート</p>
              <p className="font-heading text-xl text-primary-700">
                {report.summary.newCustomerCount}／{report.summary.repeatCustomerCount}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4">
              <p className="text-xs text-neutral-500">指名売上比率</p>
              <p className="font-heading text-xl text-primary-700">
                {report.summary.nominationSalesRatio}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-4">
              <h2 className="text-sm font-medium text-neutral-600">日別売上推移</h2>
              <BarList items={report.dailySales.map((d) => ({ label: d.date, total: d.total }))} />
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-4">
              <h2 className="text-sm font-medium text-neutral-600">メニュー別売上構成</h2>
              <BarList
                items={report.courseSales.map((c) => ({ label: c.courseName, total: c.total }))}
              />
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-4">
              <h2 className="text-sm font-medium text-neutral-600">スタッフ別売上</h2>
              <BarList
                items={report.staffSales.map((s) => ({ label: s.staffName, total: s.total }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-neutral-600">明細一覧</h2>
            <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-neutral-500">
                    <th className="p-3">日付</th>
                    <th className="p-3">店舗</th>
                    <th className="p-3">会員名</th>
                    <th className="p-3">メニュー</th>
                    <th className="p-3">スタッフ</th>
                    <th className="p-3">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {report.details.map((d) => (
                    <tr key={d.id} className="border-b border-neutral-100 last:border-0">
                      <td className="p-3">{d.date}</td>
                      <td className="p-3">{d.storeName}</td>
                      <td className="p-3">{d.memberName}</td>
                      <td className="p-3">{d.courseName}</td>
                      <td className="p-3">{d.staffName ?? "指名なし"}</td>
                      <td className="p-3">{d.totalPrice.toLocaleString()}円</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: サイドバーにリンクを追加する**

`app/admin/(dashboard)/layout.tsx`の`<nav>`内、「店舗管理」リンクの後に以下を追加する:

```tsx
          <Link
            href="/admin/reports"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            売上・月報レポート
          </Link>
```

- [ ] **Step 3: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [ ] **Step 4: 全テストスイートを実行する**

```bash
npx vitest run
```

Expected: 既存161テスト＋新規4テスト＝165テストがパスする

- [ ] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## 完了確認チェックリスト

- [ ] `npx vitest run` の全テストがパスする（`lib/auth/`のbcryptタイムアウトによる既知のフラーキーさを除く）
- [ ] `npx tsc --noEmit` がエラーなく通る
- [ ] `npx eslint .` がエラーなく通る
- [ ] `/admin/reports`で期間・店舗を変更して集計結果が更新されること、CSVダウンロードが正しく動くことをユーザーがブラウザで確認する
