# フォレスパ Phase 7: 顧客管理（A-05・A-06・A-07） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 管理画面のA-05（顧客管理一覧）・A-06（顧客詳細）・A-07（顧客ステータス設定）を実装する。

**Architecture:** 既存の`app/admin/(dashboard)/`レイアウト配下に新しいページを追加する。データ取得・更新はすべて新規Server Actionsとして`app/actions/`に実装しTDDで検証する。

**Tech Stack:** Next.js App Router / TypeScript / Tailwind v4（既存Phase 0〜6基盤を使用）

**参照元資料:** `02_screenspecification.md`（A-05・A-06・A-07節）

**このPhaseで作らないもの（Phase 8以降）:** CSV/Excelエクスポート、選択顧客へのメール配信連携（A-09との連携）、来店回数推移グラフ、メモ・カルテタブ、配信履歴タブ、ステータス変化時の自動アクション設定、タグによる絞り込み。

> **実行環境に関する注記（継承）:** `.git`書き込み不可（コミットは後回し）、`.env`系ファイル読み書き不可、`npm run build`/`npm run dev`は不安定（`tsc --noEmit`/`eslint`/`vitest`を使う）。UIコンポーネントは軽量検証（tsc/eslintのみ）、データ取得・更新系Server ActionsはTDD、という前Phaseの方針を踏襲する。

---

## Task 1: 顧客一覧取得Server Action（TDD）

**Files:**
- Create: `app/actions/search-customers.ts`
- Test: `app/actions/search-customers.test.ts`

**注記:** 来店回数は`members.visit_count`（4店舗合算のキャッシュ値、テーブル設計書の確定事項）をそのまま使う。最終来店日は`completed`ステータスの予約の最新日を使う。

- [x] **Step 1: 失敗するテストを書く**

`app/actions/search-customers.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchCustomers } from "./search-customers";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findMany: vi.fn() },
  },
}));

describe("searchCustomers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps members to customer list items with status and store info", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      {
        id: 1,
        name: "佐藤 太郎",
        visitCount: 5,
        totalSpent: 40000,
        createdAt: new Date("2026-01-15T00:00:00Z"),
        status: { name: "レギュラー", colorCode: "#8AAB78" },
        primaryStore: { name: "フォレスパ 渋谷店" },
        reservations: [{ reservationDate: new Date("2026-08-20T00:00:00Z") }],
      },
    ] as never);

    const result = await searchCustomers({});

    expect(result).toEqual([
      {
        id: 1,
        name: "佐藤 太郎",
        statusName: "レギュラー",
        statusColor: "#8AAB78",
        visitCount: 5,
        totalSpent: 40000,
        lastVisitDate: "2026-08-20",
        primaryStoreName: "フォレスパ 渋谷店",
        createdAt: "2026-01-15",
      },
    ]);
  });

  it("returns null lastVisitDate and primaryStoreName when absent", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      {
        id: 2,
        name: "鈴木 花子",
        visitCount: 0,
        totalSpent: 0,
        createdAt: new Date("2026-02-01T00:00:00Z"),
        status: { name: "ビジター", colorCode: "#A9A08D" },
        primaryStore: null,
        reservations: [],
      },
    ] as never);

    const result = await searchCustomers({});

    expect(result[0].lastVisitDate).toBeNull();
    expect(result[0].primaryStoreName).toBeNull();
  });

  it("passes name/phone/status/store filters through to the query", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([] as never);

    await searchCustomers({ name: "田中", phone: "090", statusId: 2, storeId: 3 });

    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "田中", mode: "insensitive" },
          phone: { contains: "090" },
          statusId: 2,
          primaryStoreId: 3,
        }),
      }),
    );
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/search-customers.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/search-customers.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";

export interface CustomerListItem {
  id: number;
  name: string;
  statusName: string;
  statusColor: string;
  visitCount: number;
  totalSpent: number;
  lastVisitDate: string | null;
  primaryStoreName: string | null;
  createdAt: string;
}

export interface CustomerSearchParams {
  name?: string;
  phone?: string;
  statusId?: number;
  storeId?: number;
}

export async function searchCustomers(
  params: CustomerSearchParams,
): Promise<CustomerListItem[]> {
  const members = await prisma.member.findMany({
    where: {
      ...(params.name ? { name: { contains: params.name, mode: "insensitive" } } : {}),
      ...(params.phone ? { phone: { contains: params.phone } } : {}),
      ...(params.statusId ? { statusId: params.statusId } : {}),
      ...(params.storeId ? { primaryStoreId: params.storeId } : {}),
    },
    include: {
      status: true,
      primaryStore: true,
      reservations: {
        where: { status: "completed" },
        orderBy: { reservationDate: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return members.map((m) => ({
    id: m.id,
    name: m.name,
    statusName: m.status.name,
    statusColor: m.status.colorCode,
    visitCount: m.visitCount,
    totalSpent: m.totalSpent,
    lastVisitDate: m.reservations[0]?.reservationDate.toISOString().slice(0, 10) ?? null,
    primaryStoreName: m.primaryStore?.name ?? null,
    createdAt: m.createdAt.toISOString().slice(0, 10),
  }));
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/search-customers.test.ts
```

Expected: PASS（3 tests）

- [x] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [x] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 2: 顧客管理一覧UI（軽量検証）

**Files:**
- Create: `app/admin/(dashboard)/customers/page.tsx`

- [x] **Step 1: 実装する**

`app/admin/(dashboard)/customers/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { searchCustomers, type CustomerListItem } from "@/app/actions/search-customers";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export default function AdminCustomersPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);

  useEffect(() => {
    searchCustomers({
      name: name || undefined,
      phone: phone || undefined,
    }).then(setCustomers);
  }, [name, phone]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">顧客管理</h1>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="氏名で検索"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />
        <input
          type="text"
          placeholder="電話番号で検索"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">会員ID</th>
              <th className="p-3">氏名</th>
              <th className="p-3">ステータス</th>
              <th className="p-3">来店回数</th>
              <th className="p-3">累計金額</th>
              <th className="p-3">最終来店日</th>
              <th className="p-3">所属店舗</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-neutral-100 last:border-0">
                <td className="p-3">
                  <Link href={`/admin/customers/${c.id}`} className="text-primary-700 underline">
                    {c.id}
                  </Link>
                </td>
                <td className="p-3">{c.name}</td>
                <td className="p-3">
                  <span
                    className="rounded-full px-2 py-1 text-xs text-white"
                    style={{ backgroundColor: c.statusColor }}
                  >
                    {c.statusName}
                  </span>
                </td>
                <td className="p-3">{c.visitCount}</td>
                <td className="p-3">{formatYen(c.totalSpent)}</td>
                <td className="p-3">{c.lastVisitDate ?? "—"}</td>
                <td className="p-3">{c.primaryStoreName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">該当する顧客がいません。</p>
        )}
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

## Task 3: 顧客詳細取得Server Action（TDD）

**Files:**
- Create: `app/actions/customer-detail.ts`
- Test: `app/actions/customer-detail.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`app/actions/customer-detail.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCustomerDetail } from "./customer-detail";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findUnique: vi.fn() },
  },
}));

describe("getCustomerDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the member does not exist", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null as never);

    const result = await getCustomerDetail(999);

    expect(result).toBeNull();
  });

  it("maps a member with reservation history", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 1,
      name: "佐藤 太郎",
      nameKana: "サトウ タロウ",
      email: "taro@example.com",
      phone: "090-0000-0000",
      birthDate: new Date("1990-04-01T00:00:00Z"),
      gender: "male",
      lineUserId: "U123",
      visitCount: 3,
      totalSpent: 24000,
      status: { name: "レギュラー", colorCode: "#8AAB78" },
      reservations: [
        {
          id: 10,
          reservationDate: new Date("2026-08-20T00:00:00Z"),
          store: { name: "フォレスパ 渋谷店" },
          staff: { name: "田中 花子" },
          totalPrice: 8000,
          status: "completed",
          items: [{ itemType: "course", course: { name: "スタンダード" } }],
        },
      ],
    } as never);

    const result = await getCustomerDetail(1);

    expect(result).toEqual({
      id: 1,
      name: "佐藤 太郎",
      nameKana: "サトウ タロウ",
      email: "taro@example.com",
      phone: "090-0000-0000",
      birthDate: "1990-04-01",
      gender: "male",
      lineLinked: true,
      statusName: "レギュラー",
      statusColor: "#8AAB78",
      visitCount: 3,
      totalSpent: 24000,
      reservationHistory: [
        {
          id: 10,
          date: "2026-08-20",
          storeName: "フォレスパ 渋谷店",
          courseName: "スタンダード",
          staffName: "田中 花子",
          totalPrice: 8000,
          status: "completed",
        },
      ],
    });
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/customer-detail.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/customer-detail.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";

export interface ReservationHistoryItem {
  id: number;
  date: string;
  storeName: string;
  courseName: string;
  staffName: string | null;
  totalPrice: number;
  status: string;
}

export interface CustomerDetail {
  id: number;
  name: string;
  nameKana: string | null;
  email: string;
  phone: string;
  birthDate: string;
  gender: string;
  lineLinked: boolean;
  statusName: string;
  statusColor: string;
  visitCount: number;
  totalSpent: number;
  reservationHistory: ReservationHistoryItem[];
}

export async function getCustomerDetail(memberId: number): Promise<CustomerDetail | null> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      status: true,
      reservations: {
        where: { status: { in: ["completed", "confirmed"] } },
        orderBy: { reservationDate: "desc" },
        include: {
          store: true,
          staff: true,
          items: { include: { course: true } },
        },
      },
    },
  });

  if (!member) return null;

  return {
    id: member.id,
    name: member.name,
    nameKana: member.nameKana,
    email: member.email,
    phone: member.phone,
    birthDate: member.birthDate.toISOString().slice(0, 10),
    gender: member.gender,
    lineLinked: member.lineUserId !== null,
    statusName: member.status.name,
    statusColor: member.status.colorCode,
    visitCount: member.visitCount,
    totalSpent: member.totalSpent,
    reservationHistory: member.reservations.map((r) => ({
      id: r.id,
      date: r.reservationDate.toISOString().slice(0, 10),
      storeName: r.store.name,
      courseName: r.items.find((i) => i.itemType === "course")?.course?.name ?? "",
      staffName: r.staff?.name ?? null,
      totalPrice: r.totalPrice,
      status: r.status,
    })),
  };
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/customer-detail.test.ts
```

Expected: PASS（2 tests）

- [x] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [x] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 4: 顧客詳細UI（タブ切り替え、軽量検証）

**Files:**
- Create: `app/admin/(dashboard)/customers/[id]/page.tsx`

- [x] **Step 1: 実装する**

`app/admin/(dashboard)/customers/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { getCustomerDetail, type CustomerDetail } from "@/app/actions/customer-detail";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

const GENDER_LABEL: Record<string, string> = {
  female: "女性",
  male: "男性",
  other: "その他",
};

export default function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [tab, setTab] = useState<"basic" | "history">("basic");
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);

  useEffect(() => {
    getCustomerDetail(Number(id)).then(setCustomer);
  }, [id]);

  if (!customer) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-2xl text-primary-700">{customer.name}</h1>
        <span
          className="rounded-full px-2 py-1 text-xs text-white"
          style={{ backgroundColor: customer.statusColor }}
        >
          {customer.statusName}
        </span>
      </div>

      <div className="flex gap-2 border-b border-neutral-200">
        <button
          type="button"
          onClick={() => setTab("basic")}
          className={`px-4 py-2 text-sm ${
            tab === "basic"
              ? "border-b-2 border-primary-500 text-primary-700"
              : "text-neutral-500"
          }`}
        >
          基本情報
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`px-4 py-2 text-sm ${
            tab === "history"
              ? "border-b-2 border-primary-500 text-primary-700"
              : "text-neutral-500"
          }`}
        >
          来店履歴
        </button>
      </div>

      {tab === "basic" && (
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">フリガナ：</span>
            {customer.nameKana ?? "—"}
          </p>
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">メール：</span>
            {customer.email}
          </p>
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">電話番号：</span>
            {customer.phone}
          </p>
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">生年月日：</span>
            {customer.birthDate}
          </p>
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">性別：</span>
            {GENDER_LABEL[customer.gender] ?? customer.gender}
          </p>
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">LINE連携：</span>
            {customer.lineLinked ? "連携済み" : "未連携"}
          </p>
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">来店回数：</span>
            {customer.visitCount}回
          </p>
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">累計利用金額：</span>
            {formatYen(customer.totalSpent)}
          </p>
        </div>
      )}

      {tab === "history" && (
        <div className="flex flex-col gap-2">
          {customer.reservationHistory.length === 0 && (
            <p className="text-sm text-neutral-500">来店履歴がありません。</p>
          )}
          {customer.reservationHistory.map((h) => (
            <div
              key={h.id}
              className="rounded-lg border border-neutral-200 bg-neutral-0 p-3 shadow-sm"
            >
              <p className="text-sm font-medium text-neutral-800">
                {h.date}　{h.courseName || "（明細なし）"}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {h.storeName}　担当：{h.staffName ?? "指名なし"}　{formatYen(h.totalPrice)}
              </p>
            </div>
          ))}
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

## Task 5: 顧客ステータス設定Server Action（TDD）

**Files:**
- Create: `app/actions/customer-statuses.ts`
- Test: `app/actions/customer-statuses.test.ts`

**注記:** テーブル設計書の確定事項：「4店舗共通の1レコードセットとして管理」。店舗別の設定は行わない。

- [x] **Step 1: 失敗するテストを書く**

`app/actions/customer-statuses.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCustomerStatuses, updateStatusThreshold } from "./customer-statuses";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    customerStatus: { findMany: vi.fn(), update: vi.fn() },
  },
}));

describe("listCustomerStatuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all 5 statuses ordered by sortOrder", async () => {
    vi.mocked(prisma.customerStatus.findMany).mockResolvedValue([
      { id: 1, name: "ビジター", minVisitCount: 1, colorCode: "#A9A08D", sortOrder: 1 },
    ] as never);

    const result = await listCustomerStatuses();

    expect(result).toEqual([
      { id: 1, name: "ビジター", minVisitCount: 1, colorCode: "#A9A08D", sortOrder: 1 },
    ]);
    expect(prisma.customerStatus.findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: "asc" },
    });
  });
});

describe("updateStatusThreshold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the minVisitCount for the given status", async () => {
    vi.mocked(prisma.customerStatus.update).mockResolvedValue({} as never);

    await updateStatusThreshold({ statusId: 2, minVisitCount: 3 });

    expect(prisma.customerStatus.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { minVisitCount: 3 },
    });
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/customer-statuses.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/customer-statuses.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";

export interface CustomerStatusItem {
  id: number;
  name: string;
  minVisitCount: number;
  colorCode: string;
  sortOrder: number;
}

export async function listCustomerStatuses(): Promise<CustomerStatusItem[]> {
  const statuses = await prisma.customerStatus.findMany({ orderBy: { sortOrder: "asc" } });
  return statuses.map((s) => ({
    id: s.id,
    name: s.name,
    minVisitCount: s.minVisitCount,
    colorCode: s.colorCode,
    sortOrder: s.sortOrder,
  }));
}

export interface UpdateStatusThresholdParams {
  statusId: number;
  minVisitCount: number;
}

export async function updateStatusThreshold(
  params: UpdateStatusThresholdParams,
): Promise<void> {
  await prisma.customerStatus.update({
    where: { id: params.statusId },
    data: { minVisitCount: params.minVisitCount },
  });
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/customer-statuses.test.ts
```

Expected: PASS（2 tests）

- [x] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [x] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 6: 顧客ステータス設定UI（軽量検証）

**Files:**
- Create: `app/admin/(dashboard)/customer-statuses/page.tsx`

- [x] **Step 1: 実装する**

`app/admin/(dashboard)/customer-statuses/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  listCustomerStatuses,
  updateStatusThreshold,
  type CustomerStatusItem,
} from "@/app/actions/customer-statuses";

export default function AdminCustomerStatusesPage() {
  const [statuses, setStatuses] = useState<CustomerStatusItem[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    listCustomerStatuses().then(setStatuses);
  }, []);

  async function handleSave(statusId: number, minVisitCount: number) {
    setSaving(statusId);
    await updateStatusThreshold({ statusId, minVisitCount });
    setSaving(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">顧客ステータス設定</h1>
      <p className="text-sm text-neutral-500">
        4店舗共通の設定です。来店回数は4店舗合算でカウントされます。
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">ステータス</th>
              <th className="p-3">最低来店回数</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                <td className="p-3">
                  <span
                    className="rounded-full px-2 py-1 text-xs text-white"
                    style={{ backgroundColor: s.colorCode }}
                  >
                    {s.name}
                  </span>
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    min={0}
                    defaultValue={s.minVisitCount}
                    onBlur={(e) => handleSave(s.id, Number(e.target.value))}
                    className="h-9 w-24 rounded-md border border-neutral-300 px-2"
                  />
                </td>
                <td className="p-3 text-xs text-neutral-500">
                  {saving === s.id ? "保存中..." : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

- [x] **Step 3: サイドバーにリンクを追加する**

`app/admin/(dashboard)/layout.tsx`の`<nav>`内、「予約カレンダー」リンクの後に以下を追加する:

```tsx
          <Link
            href="/admin/customers"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            顧客管理
          </Link>
          <Link
            href="/admin/customer-statuses"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            ステータス設定
          </Link>
```

- [x] **Step 4: 全テストスイートを実行する**

```bash
npx tsc --noEmit
npx eslint .
npx vitest run
```

Expected: 既存の115テスト＋新規7テスト（Task1×3, Task3×2, Task5×2）＝122テストがパスする

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## 完了確認チェックリスト

- [x] `npx vitest run` の全テストがパスする
- [x] `npx tsc --noEmit` がエラーなく通る
- [x] `npx eslint .` がエラーなく通る
- [x] `/admin/customers`で検索・一覧表示、`/admin/customers/[id]`で詳細（基本情報・来店履歴タブ）、`/admin/customer-statuses`で閾値編集をユーザーがブラウザで確認する（`npm run dev`はこのサンドボックスでは起動確認できないため、ユーザーのターミナルで確認する）
